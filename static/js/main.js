document.addEventListener("DOMContentLoaded", () => {
  console.log("Document loaded, initializing app...")

  // Get DOM elements
  const searchForm = document.getElementById("search-form")
  const urlInput = document.getElementById("video-url")
  const searchButton = document.getElementById("search-button")
  const videoInfoContainer = document.getElementById("video-info")
  const loadingSpinner = document.getElementById("loading-spinner")
  const errorMessage = document.getElementById("error-message")

  // Debug info
  console.log("Search form:", searchForm)
  console.log("URL input:", urlInput)
  console.log("Search button:", searchButton)

  // Handle form submission
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault()
      console.log("Form submitted, searching video...")
      searchVideo()
    })
  } else {
    console.error("Search form not found in the DOM")
  }

  // Direct click on search button as fallback
  if (searchButton) {
    searchButton.addEventListener("click", (e) => {
      e.preventDefault()
      console.log("Search button clicked directly")
      searchVideo()
    })
  }

  // Search video function
  function searchVideo() {
    const url = urlInput ? urlInput.value.trim() : ""
    console.log("Searching for URL:", url)

    if (!url) {
      showError("Please enter a YouTube URL")
      return
    }

    // Show loading spinner
    if (loadingSpinner) loadingSpinner.style.display = "block"
    if (videoInfoContainer) videoInfoContainer.style.display = "none"
    if (errorMessage) errorMessage.style.display = "none"

    console.log("Sending direct request to get video info")

    // Send direct request to get video info (skip validation step)
    fetch("/api/video-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    })
      .then((response) => {
        console.log("Response status:", response.status)
        return response.json()
      })
      .then((data) => {
        console.log("Video info response:", data)
        if (loadingSpinner) loadingSpinner.style.display = "none"

        if (data.success) {
          displayVideoInfo(data)
        } else {
          showError(data.error || "Error retrieving video information")
        }
      })
      .catch((error) => {
        console.error("Error fetching video info:", error)
        if (loadingSpinner) loadingSpinner.style.display = "none"
        showError("Error retrieving video information: " + error.message)
      })
  }

  // Display video info function
  function displayVideoInfo(data) {
    console.log("Displaying video info:", data)

    if (!videoInfoContainer) {
      console.error("Video info container not found")
      return
    }

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
    console.log("Video info displayed")

    // Add event listeners to download buttons
    document.querySelectorAll(".download-form").forEach((form) => {
      form.addEventListener("submit", function (e) {
        e.preventDefault()
        console.log("Download form submitted")

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
            console.log("Download response:", data)
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
            console.error("Download error:", error)
            showError("Error processing download: " + error.message)
            downloadButton.innerHTML = originalButtonText
            downloadButton.disabled = false
          })
      })
    })
  }

  // Show error function
  function showError(message) {
    console.error("Error:", message)
    if (errorMessage) {
      errorMessage.textContent = message
      errorMessage.style.display = "block"
    } else {
      alert("Error: " + message)
    }
    if (videoInfoContainer) videoInfoContainer.style.display = "none"
    if (loadingSpinner) loadingSpinner.style.display = "none"
  }

  // Test function to verify JavaScript is working
  console.log("JavaScript initialized successfully")

  // Add a visible indicator that JS is working
  const jsIndicator = document.createElement("div")
  jsIndicator.style.display = "none" // Hidden by default, but exists in DOM
  jsIndicator.id = "js-working-indicator"
  document.body.appendChild(jsIndicator)
})
