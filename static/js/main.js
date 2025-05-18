document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    const navToggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('nav');
    
    // Toggle mobile navigation
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
        });
    }

    // FAQ Accordion
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const faqItem = this.parentElement;
            faqItem.classList.toggle('active');
        });
    });

    // Download Form
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('video-url');
    const urlError = document.getElementById('url-error');
    const searchBtn = document.getElementById('search-btn');
    const loader = document.getElementById('loader');
    const result = document.getElementById('result');
    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoTitle = document.getElementById('video-title');
    const videoAuthor = document.getElementById('video-author');
    const videoDuration = document.getElementById('video-duration');
    const videoViews = document.getElementById('video-views');
    const downloadOptions = document.getElementById('download-options');

    // Only proceed if we're on a page with the download form
    if (form) {
        // Real-time URL validation
        urlInput.addEventListener('input', function() {
            const url = urlInput.value.trim();
            if (url) {
                // Validate URL format client-side
                fetch('/api/validate-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: url }),
                })
                .then(response => response.json())
                .then(data => {
                    if (!data.valid) {
                        urlError.textContent = data.error;
                    } else {
                        urlError.textContent = "";
                    }
                })
                .catch(error => {
                    console.error('Error validating URL:', error);
                });
            } else {
                urlError.textContent = "";
            }
        });

        // Handle form submission
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const url = urlInput.value.trim();
            
            // Validate URL
            if (!url) {
                urlError.textContent = "Please enter a YouTube URL";
                return;
            }
            
            // Show loader
            searchBtn.disabled = true;
            loader.style.display = "block";
            result.style.display = "none";
            
            try {
                // Get video info from server
                const response = await fetch('/api/video-info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: url }),
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    urlError.textContent = data.error;
                    loader.style.display = "none";
                    searchBtn.disabled = false;
                    return;
                }
                
                // Update UI with video data
                videoThumbnail.src = data.thumbnail;
                videoThumbnail.alt = data.title;
                videoTitle.textContent = data.title;
                videoAuthor.textContent = data.author;
                videoDuration.textContent = `Duration: ${data.duration}`;
                videoViews.textContent = `Views: ${data.views}`;
                
                // Clear previous download options
                downloadOptions.innerHTML = '';
                
                // Add download buttons for each format
                data.formats.forEach(format => {
                    const downloadBtn = document.createElement('div');
                    downloadBtn.className = 'download-btn';
                    
                    const button = document.createElement('button');
                    button.innerHTML = `<i class="fas fa-${format.id === 'mp3' ? 'music' : 'download'}"></i> Download ${format.name}`;
                    button.addEventListener('click', function() {
                        downloadVideo(url, format.id);
                    });
                    
                    downloadBtn.appendChild(button);
                    downloadOptions.appendChild(downloadBtn);
                });
                
                // Show result
                result.style.display = "block";
            } catch (error) {
                console.error('Error:', error);
                urlError.textContent = "Error processing video. Please try again.";
            } finally {
                // Hide loader
                loader.style.display = "none";
                searchBtn.disabled = false;
            }
        });

        // Function to handle download
        function downloadVideo(url, format) {
            // Create a form to submit the download request
            const downloadForm = document.createElement('form');
            downloadForm.method = 'POST';
            downloadForm.action = '/download';
            
            // Add URL input
            const urlInput = document.createElement('input');
            urlInput.type = 'hidden';
            urlInput.name = 'url';
            urlInput.value = url;
            downloadForm.appendChild(urlInput);
            
            // Add format input
            const formatInput = document.createElement('input');
            formatInput.type = 'hidden';
            formatInput.name = 'format';
            formatInput.value = format;
            downloadForm.appendChild(formatInput);
            
            // Add CSRF token if needed (for Flask with CSRF protection)
            if (window.csrfToken) {
                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = 'csrf_token';
                csrfInput.value = window.csrfToken;
                downloadForm.appendChild(csrfInput);
            }
            
            // Submit the form
            document.body.appendChild(downloadForm);
            
            // Show loading message
            const downloadBtn = event.target;
            const originalText = downloadBtn.innerHTML;
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            // Submit the form and handle the response
            fetch(downloadForm.action, {
                method: 'POST',
                body: new FormData(downloadForm)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Create a temporary link and trigger download
                    const link = document.createElement('a');
                    link.href = data.download_url;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Reset button
                    downloadBtn.innerHTML = originalText;
                    downloadBtn.disabled = false;
                } else {
                    alert('Download failed: ' + data.error);
                    downloadBtn.innerHTML = originalText;
                    downloadBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during download. Please try again.');
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            });
            
            // Clean up
            document.body.removeChild(downloadForm);
        }