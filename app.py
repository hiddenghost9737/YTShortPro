from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file, abort
import re
import os
import uuid
import time
import yt_dlp
from werkzeug.utils import secure_filename
import logging
from logging.handlers import RotatingFileHandler
import shutil
from datetime import datetime, timedelta

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')
    
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('logs/app.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_change_in_production')
app.config['DOWNLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500 MB max upload size

# Create downloads directory if it doesn't exist
if not os.path.exists(app.config['DOWNLOAD_FOLDER']):
    os.makedirs(app.config['DOWNLOAD_FOLDER'])

# Clean up old downloads periodically (files older than 1 hour)
def cleanup_old_downloads():
    now = datetime.now()
    count = 0
    try:
        for filename in os.listdir(app.config['DOWNLOAD_FOLDER']):
            file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
            if os.path.isfile(file_path):
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                if now - file_time > timedelta(hours=1):
                    os.remove(file_path)
                    count += 1
        logger.info(f"Cleaned up {count} old download files")
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")

# Helper function to validate YouTube URL
def is_valid_youtube_url(url):
    # Match both YouTube Shorts and regular YouTube videos
    youtube_regex = r'(https?://)?(www\.)?(youtube\.com/shorts/|youtube\.com/watch\?v=|youtu\.be/)[a-zA-Z0-9_-]{11}(\?.*)?$'
    return re.match(youtube_regex, url) is not None

# Helper function to extract video ID from URL
def extract_video_id(url):
    # Extract from shorts URL
    shorts_regex = r'(?:youtube\.com/shorts/|youtu\.be/)([a-zA-Z0-9_-]{11})'
    shorts_match = re.search(shorts_regex, url)
    if shorts_match:
        return shorts_match.group(1)
    
    # Extract from regular video URL
    video_regex = r'(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})'
    video_match = re.search(video_regex, url)
    if video_match:
        return video_match.group(1)
    
    return None

# Routes
@app.route('/')
def home():
    return render_template('index.html', active_page='home')

@app.route('/about')
def about():
    return render_template('index.html', active_page='about')

@app.route('/faq')
def faq():
    return render_template('index.html', active_page='faq')

@app.route('/contact')
def contact():
    return render_template('index.html', active_page='contact')

@app.route('/terms')
def terms():
    return render_template('index.html', active_page='terms')

@app.route('/privacy')
def privacy():
    return render_template('index.html', active_page='privacy')

@app.route('/disclaimer')
def disclaimer():
    return render_template('index.html', active_page='disclaimer')

@app.route('/dmca')
def dmca():
    return render_template('index.html', active_page='dmca')

@app.route('/api/validate-url', methods=['POST'])
def validate_url():
    data = request.get_json()
    url = data.get('url', '')
    
    if not url:
        return jsonify({'valid': False, 'error': 'Please enter a YouTube URL'})
    
    if not is_valid_youtube_url(url):
        return jsonify({'valid': False, 'error': 'Please enter a valid YouTube URL'})
    
    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({'valid': False, 'error': 'Could not extract video ID from URL'})
    
    return jsonify({'valid': True, 'video_id': video_id})

@app.route('/api/video-info', methods=['POST'])
def get_video_info():
    data = request.get_json()
    url = data.get('url', '')
    
    if not url or not is_valid_youtube_url(url):
        return jsonify({'success': False, 'error': 'Invalid YouTube URL'})
    
    try:
        # Configure yt-dlp options
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'format': 'best',
        }
        
        # Get video info
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Format the response
            response = {
                'success': True,
                'id': info.get('id'),
                'title': info.get('title'),
                'author': info.get('uploader'),
                'duration': str(timedelta(seconds=info.get('duration', 0))),
                'views': f"{info.get('view_count', 0):,}",
                'thumbnail': info.get('thumbnail'),
                'formats': []
            }
            
            # Add available formats
            if info.get('formats'):
                # MP4 HD
                hd_formats = [f for f in info['formats'] if f.get('ext') == 'mp4' and f.get('height', 0) >= 720]
                if hd_formats:
                    response['formats'].append({
                        'id': 'mp4-hd',
                        'name': 'MP4 HD',
                        'quality': f"{hd_formats[0].get('height', 720)}p"
                    })
                
                # MP4 SD
                sd_formats = [f for f in info['formats'] if f.get('ext') == 'mp4' and f.get('height', 0) < 720 and f.get('height', 0) >= 360]
                if sd_formats:
                    response['formats'].append({
                        'id': 'mp4-sd',
                        'name': 'MP4 SD',
                        'quality': f"{sd_formats[0].get('height', 480)}p"
                    })
                
                # MP3 Audio
                response['formats'].append({
                    'id': 'mp3',
                    'name': 'MP3',
                    'quality': 'Audio Only'
                })
            
            return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        return jsonify({'success': False, 'error': f"Error processing video: {str(e)}"})

@app.route('/download', methods=['POST'])
def download_video():
    url = request.form.get('url')
    format_id = request.form.get('format')
    
    if not url or not format_id:
        return jsonify({'success': False, 'error': 'Missing URL or format'})
    
    if not is_valid_youtube_url(url):
        return jsonify({'success': False, 'error': 'Invalid YouTube URL'})
    
    # Create a unique filename
    unique_id = str(uuid.uuid4())
    output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], unique_id)
    
    try:
        # Configure yt-dlp options based on format
        if format_id == 'mp3':
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'outtmpl': f'{output_path}.%(ext)s',
                'quiet': True,
            }
            final_ext = 'mp3'
        elif format_id == 'mp4-sd':
            ydl_opts = {
                'format': 'best[height<=480][ext=mp4]/best[height<=480]/best[ext=mp4]/best',
                'merge_output_format': 'mp4',
                'outtmpl': f'{output_path}.%(ext)s',
                'quiet': True,
            }
            final_ext = 'mp4'
        else:  # mp4-hd
            ydl_opts = {
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'merge_output_format': 'mp4',
                'outtmpl': f'{output_path}.%(ext)s',
                'quiet': True,
            }
            final_ext = 'mp4'
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'video')
            
            # Sanitize filename
            safe_title = secure_filename(title)
            download_name = f"{safe_title}.{final_ext}"
            
            # Get the actual file path
            actual_file = f"{output_path}.{final_ext}"
            
            # Check if file exists
            if not os.path.exists(actual_file):
                return jsonify({'success': False, 'error': 'Download failed'})
            
            # Return the download URL
            download_url = url_for('serve_download', filename=os.path.basename(actual_file), 
                                  download_name=download_name, _external=True)
            return jsonify({'success': True, 'download_url': download_url})
    
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'success': False, 'error': f"Download failed: {str(e)}"})

@app.route('/downloads/<filename>')
def serve_download(filename):
    download_name = request.args.get('download_name', filename)
    try:
        return send_file(
            os.path.join(app.config['DOWNLOAD_FOLDER'], filename),
            as_attachment=True,
            download_name=download_name
        )
    except Exception as e:
        logger.error(f"Error serving download: {str(e)}")
        abort(404)

@app.route('/contact-submit', methods=['POST'])
def contact_submit():
    name = request.form.get('name')
    email = request.form.get('email')
    subject = request.form.get('subject')
    message = request.form.get('message')
    
    # In a real application, you would process this data (e.g., send an email, store in database)
    # For this example, we'll just log it
    logger.info(f"Contact form submission: {name} ({email}): {subject}")
    
    # Return success response
    return jsonify({'success': True, 'message': 'Thank you for your message! We will get back to you soon.'})

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500

@app.before_request
def before_request():
    # Run cleanup occasionally (1% chance per request)
    if time.time() % 100 < 1:
        cleanup_old_downloads()

if __name__ == '__main__':
    app.run(debug=True)