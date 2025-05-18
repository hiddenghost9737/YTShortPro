from flask import Flask, render_template, request, jsonify, send_file, abort, redirect, url_for
import os
import re
import uuid
import json
import logging
import shutil
import tempfile
import subprocess
from datetime import datetime
from urllib.parse import urlparse, parse_qs

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['DOWNLOAD_FOLDER'] = 'downloads'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500 MB

# Create downloads directory if it doesn't exist
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

# Helper function to extract video ID from YouTube URL
def extract_video_id(url):
    logger.debug(f"Extracting video ID from URL: {url}")
    
    # Try to parse the URL
    parsed_url = urlparse(url)
    
    # Check if it's a valid URL
    if not parsed_url.netloc:
        logger.warning(f"Invalid URL format: {url}")
        return None
    
    # Check if it's a YouTube URL
    if 'youtube.com' in parsed_url.netloc:
        if '/watch' in parsed_url.path:
            # Regular YouTube URL
            query_params = parse_qs(parsed_url.query)
            video_id = query_params.get('v', [None])[0]
            logger.debug(f"Extracted video ID from watch URL: {video_id}")
            return video_id
        elif '/shorts/' in parsed_url.path:
            # YouTube Shorts URL
            video_id = parsed_url.path.split('/shorts/')[1]
            # Remove any additional path components
            video_id = video_id.split('/')[0]
            logger.debug(f"Extracted video ID from shorts URL: {video_id}")
            return video_id
    elif 'youtu.be' in parsed_url.netloc:
        # Short YouTube URL
        video_id = parsed_url.path.lstrip('/')
        # Remove any additional path components
        video_id = video_id.split('/')[0]
        logger.debug(f"Extracted video ID from short URL: {video_id}")
        return video_id
    
    logger.warning(f"Could not extract video ID from URL: {url}")
    return None

# Check if yt-dlp is installed
def is_yt_dlp_installed():
    try:
        subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, check=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        logger.error("yt-dlp is not installed or not in PATH")
        return False

# Check if ffmpeg is installed
def is_ffmpeg_installed():
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        logger.error("ffmpeg is not installed or not in PATH")
        return False

# Routes
@app.route('/')
def index():
    logger.info("Rendering index page")
    return render_template('index.html')

@app.route('/api/validate-url', methods=['POST'])
def validate_url():
    logger.info("Validating URL")
    try:
        data = request.get_json()
        url = data.get('url', '')
        
        logger.debug(f"Received URL for validation: {url}")
        
        if not url:
            logger.warning("Empty URL received")
            return jsonify({'valid': False, 'error': 'URL is required'})
        
        video_id = extract_video_id(url)
        
        if not video_id:
            logger.warning(f"Invalid YouTube URL: {url}")
            return jsonify({'valid': False, 'error': 'Invalid YouTube URL'})
        
        logger.info(f"URL validated successfully, video ID: {video_id}")
        return jsonify({'valid': True, 'video_id': video_id})
    
    except Exception as e:
        logger.exception(f"Error validating URL: {str(e)}")
        return jsonify({'valid': False, 'error': f'Error validating URL: {str(e)}'})

@app.route('/api/video-info', methods=['POST'])
def get_video_info():
    logger.info("Getting video info")
    try:
        data = request.get_json()
        url = data.get('url', '')
        
        logger.debug(f"Received URL for video info: {url}")
        
        if not url:
            logger.warning("Empty URL received")
            return jsonify({'success': False, 'error': 'URL is required'})
        
        # Check if yt-dlp is installed
        if not is_yt_dlp_installed():
            logger.error("yt-dlp is not installed")
            return jsonify({'success': False, 'error': 'yt-dlp is not installed. Please install yt-dlp to use this application.'})
        
        # Extract video information using yt-dlp
        try:
            logger.debug(f"Running yt-dlp to get video info for URL: {url}")
            
            # Use yt-dlp to get video info in JSON format
            cmd = ['yt-dlp', '-j', url]
            logger.debug(f"Running command: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            video_data = json.loads(result.stdout)
            
            logger.debug(f"Video data retrieved successfully")
            
            # Extract relevant information
            video_id = video_data.get('id', '')
            title = video_data.get('title', 'Unknown Title')
            author = video_data.get('uploader', 'Unknown Author')
            
            # Format duration
            duration_seconds = video_data.get('duration', 0)
            minutes, seconds = divmod(int(duration_seconds), 60)
            hours, minutes = divmod(minutes, 60)
            
            if hours > 0:
                duration = f"{hours}:{minutes:02d}:{seconds:02d}"
            else:
                duration = f"{minutes}:{seconds:02d}"
            
            # Format view count
            view_count = video_data.get('view_count', 0)
            views = f"{view_count:,}"
            
            # Get thumbnail URL
            thumbnail = video_data.get('thumbnail', '')
            
            # Define available formats
            formats = [
                {
                    'id': 'mp4-hd',
                    'name': 'MP4 HD',
                    'quality': '1080p'
                },
                {
                    'id': 'mp4-sd',
                    'name': 'MP4 SD',
                    'quality': '480p'
                },
                {
                    'id': 'mp3',
                    'name': 'MP3',
                    'quality': 'Audio Only'
                }
            ]
            
            logger.info(f"Video info retrieved successfully for video ID: {video_id}")
            
            # Return video information
            return jsonify({
                'success': True,
                'id': video_id,
                'title': title,
                'author': author,
                'duration': duration,
                'views': views,
                'thumbnail': thumbnail,
                'formats': formats,
                'url': url  # Include the original URL
            })
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running yt-dlp: {e.stderr}")
            return jsonify({'success': False, 'error': f'Error retrieving video information: {e.stderr}'})
        
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing yt-dlp output: {str(e)}")
            return jsonify({'success': False, 'error': 'Error parsing video information'})
    
    except Exception as e:
        logger.exception(f"Error getting video info: {str(e)}")
        return jsonify({'success': False, 'error': f'Error retrieving video information: {str(e)}'})

@app.route('/download', methods=['POST'])
def download_video():
    logger.info("Processing download request")
    try:
        url = request.form.get('url', '')
        format_id = request.form.get('format', '')
        
        logger.debug(f"Download request - URL: {url}, Format: {format_id}")
        
        if not url or not format_id:
            logger.warning("Missing URL or format in download request")
            return jsonify({'success': False, 'error': 'URL and format are required'})
        
        # Check if yt-dlp and ffmpeg are installed
        if not is_yt_dlp_installed():
            logger.error("yt-dlp is not installed")
            return jsonify({'success': False, 'error': 'yt-dlp is not installed. Please install yt-dlp to use this application.'})
        
        if not is_ffmpeg_installed():
            logger.error("ffmpeg is not installed")
            return jsonify({'success': False, 'error': 'ffmpeg is not installed. Please install ffmpeg to use this application.'})
        
        # Create a unique filename
        unique_id = str(uuid.uuid4())
        output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], unique_id)
        
        # Set yt-dlp options based on format
        if format_id == 'mp4-hd':
            ydl_opts = {
                'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                'merge_output_format': 'mp4',
                'outtmpl': f'{output_path}.%(ext)s',
                'quiet': True,
            }
            final_ext = 'mp4'
        
        elif format_id == 'mp4-sd':
            ydl_opts = {
                'format': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
                'merge_output_format': 'mp4',
                'outtmpl': f'{output_path}.%(ext)s',
                'quiet': True,
            }
            final_ext = 'mp4'
        
        elif format_id == 'mp3':
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
        
        else:
            logger.warning(f"Invalid format requested: {format_id}")
            return jsonify({'success': False, 'error': 'Invalid format'})
        
        # Download the video using yt-dlp
        try:
            logger.debug(f"Running yt-dlp to download video with options: {ydl_opts}")
            
            # Convert ydl_opts to command line arguments
            cmd = ['yt-dlp']
            
            if format_id == 'mp4-hd':
                cmd.extend(['-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'])
                cmd.extend(['--merge-output-format', 'mp4'])
            elif format_id == 'mp4-sd':
                cmd.extend(['-f', 'bestvideo[height<=480]+bestaudio/best[height<=480]'])
                cmd.extend(['--merge-output-format', 'mp4'])
            elif format_id == 'mp3':
                cmd.extend(['-f', 'bestaudio/best'])
                cmd.extend(['--extract-audio', '--audio-format', 'mp3', '--audio-quality', '192'])
            
            cmd.extend(['-o', f'{output_path}.%(ext)s'])
            cmd.extend(['--quiet'])
            cmd.append(url)
            
            logger.debug(f"Running command: {' '.join(cmd)}")
            
            subprocess.run(cmd, check=True)
            
            # Get the title for the filename
            info_cmd = ['yt-dlp', '--get-title', url]
            result = subprocess.run(info_cmd, capture_output=True, text=True, check=True)
            title = result.stdout.strip()
            
            # Clean the title for use in a filename
            title = re.sub(r'[^\w\s-]', '', title)
            title = re.sub(r'[-\s]+', '-', title).strip('-_')
            
            # Final file path
            final_file = f"{output_path}.{final_ext}"
            
            if not os.path.exists(final_file):
                logger.error(f"Downloaded file not found: {final_file}")
                return jsonify({'success': False, 'error': 'Error processing video'})
            
            logger.info(f"Video downloaded successfully: {final_file}")
            
            # Generate download URL
            download_url = f"/downloads/{unique_id}?download_name={title}.{final_ext}"
            
            return jsonify({
                'success': True,
                'download_url': download_url
            })
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running yt-dlp for download: {e.stderr if hasattr(e, 'stderr') else str(e)}")
            return jsonify({'success': False, 'error': 'Error processing video'})
    
    except Exception as e:
        logger.exception(f"Error downloading video: {str(e)}")
        return jsonify({'success': False, 'error': f'Error processing video: {str(e)}'})

@app.route('/downloads/<file_id>')
def serve_download(file_id):
    logger.info(f"Serving download for file ID: {file_id}")
    try:
        download_name = request.args.get('download_name', 'download')
        
        # Sanitize file_id to prevent directory traversal
        if not re.match(r'^[a-zA-Z0-9-]+$', file_id):
            logger.warning(f"Invalid file ID requested: {file_id}")
            abort(404)
        
        # Find the file with the given ID
        for ext in ['mp4', 'mp3']:
            file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], f"{file_id}.{ext}")
            if os.path.exists(file_path):
                logger.info(f"Serving file: {file_path} as {download_name}")
                return send_file(
                    file_path,
                    as_attachment=True,
                    download_name=download_name
                )
        
        logger.warning(f"File not found for ID: {file_id}")
        abort(404)
    
    except Exception as e:
        logger.exception(f"Error serving download: {str(e)}")
        abort(500)

@app.route('/test-js')
def test_js():
    """Simple route to test if JavaScript is working"""
    return jsonify({'status': 'success', 'message': 'JavaScript is working'})

@app.errorhandler(404)
def page_not_found(e):
    logger.warning(f"404 error: {request.path}")
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"500 error: {str(e)}")
    return render_template('500.html'), 500

if __name__ == '__main__':
    logger.info("Starting application")
    app.run(debug=True)
            
