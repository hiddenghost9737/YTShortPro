document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form")
  const urlInput = document.getElementById("video-url")
  const searchButton = document.getElementById("search-button")
  const videoInfoContainer = document.getElementById("video-info")
  const loadingSpinner = document.getElementById("loading-spinner")
  const errorMessage = document.getElementById("error-message")

  // Handle form submission
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault()
    searchVideo()
  })

  // Search video function
  function searchVideo() {
    const url = urlInput.value.trim()

    if (!url) {
      showError("Please enter a YouTube URL")
      return
    }

    // Show loading spinner
    loadingSpinner.style.display = "block"
    videoInfoContainer.style.display = "none"
    errorMessage.style.display = "none"

    // Send AJAX request to validate URL
    fetch("/api/validate-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.valid) {
          // URL is valid, get video info
          getVideoInfo(url)
        } else {
          showError(data.error || "Invalid YouTube URL")
          loadingSpinner.style.display = "none"
        }
      })
      .catch((error) => {
        showError("Error validating URL: " + error.message)
        loadingSpinner.style.display = "none"
      })
  }

  // Get video info function
  function getVideoInfo(url) {
    fetch("/api/video-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    })
      .then((response) => response.json())
      .then((data) => {
        loadingSpinner.style.display = "none"

        if (data.success) {
          displayVideoInfo(data)
        } else {
          showError(data.error || "Error retrieving video information")
        }
      })
      .catch((error) => {
        loadingSpinner.style.display = "none"
        showError("Error retrieving video information: " + error.message)
      })
  }

  // Display video info function
  function displayVideoInfo(data) {
    // Clear previous content
    videoInfoContainer.innerHTML = ""

    // Create video info HTML
    const videoInfoHTML = `
            <div class="video-details">
                <div class="video-thumbnail">
                    <img src="${data.thumbnail}" alt="${data.title}" />
                </div>
                <div class="video-metadata">
                    <h3 class="video-title">${data.title}</h3>
                    <p class="video-author">By: ${data.author}</p>
                    <p class="video-stats">
                        <span class="video-duration">${data.duration}</span>
                        <span class="video-views">${data.views} views</span>
                    </p>
                </div>
            </div>
            <div class="download-options">
                <h4>Download Options</h4>
                <div class="format-buttons">
                    ${data.formats
                      .map(
                        (format) => `
                        <form action="/download" method="post" class="download-form">
                            <input type="hidden" name="url" value="${data.url || urlInput.value}">
                            <input type="hidden" name="format" value="${format.id}">
                            <button type="submit" class="download-button">
                                <span class="format-name">${format.name}</span>
                                <span class="format-quality">${format.quality}</span>
                            </button>
                        </form>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `

    // Set the HTML and show the container
    videoInfoContainer.innerHTML = videoInfoHTML
    videoInfoContainer.style.display = "block"

    // Add event listeners to download buttons
    document.querySelectorAll(".download-form").forEach((form) => {
      form.addEventListener("submit", function (e) {
        e.preventDefault()

        const formData = new FormData(this)
        const downloadUrl = this.getAttribute("action")
        const downloadButton = this.querySelector(".download-button")

        // Change button text to show loading
        const originalButtonText = downloadButton.innerHTML
        downloadButton.innerHTML = '<span class="spinner"></span> Processing...'
        downloadButton.disabled = true

        // Send download request
        fetch(downloadUrl, {
          method: "POST",
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              // Create a hidden link and click it to start download
              const downloadLink = document.createElement("a")
              downloadLink.href = data.download_url
              downloadLink.download = ""
              document.body.appendChild(downloadLink)
              downloadLink.click()
              document.body.removeChild(downloadLink)

              // Reset button
              downloadButton.innerHTML = originalButtonText
              downloadButton.disabled = false
            } else {
              showError(data.error || "Error processing download")
              downloadButton.innerHTML = originalButtonText
              downloadButton.disabled = false
            }
          })
          .catch((error) => {
            showError("Error processing download: " + error.message)
            downloadButton.innerHTML = originalButtonText
            downloadButton.disabled = false
          })
      })
    })
  }

  // Show error function
  function showError(message) {
    errorMessage.textContent = message
    errorMessage.style.display = "block"
    videoInfoContainer.style.display = "none"
  }

  // Initialize 3D visualization if available
  let initThreeDemo
  if (typeof initThreeDemo === "function") {
    initThreeDemo()
  }
})
