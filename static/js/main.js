document.addEventListener("DOMContentLoaded", () => {
  console.log("Document loaded, initializing app...")

  // Get DOM elements
  const searchForm = document.getElementById("search-form")
  const urlInput = document.getElementById("video-url")
  const searchButton = document.getElementById("search-button")
  const videoInfoContainer = document.getElementById("video-info")
  const loadingSpinner = document.getElementById("loading-spinner")
  const errorMessage = document.getElementById("error-message")
  const rateLimitInfo = document.getElementById("rate-limit-info") || document.createElement("div")
  const torStatusContainer = document.getElementById("tor-status-container")
  const torToggleBtn = document.getElementById("tor-toggle")
  const torRotateBtn = document.getElementById("tor-rotate-ip")
  const torStatusText = document.getElementById("tor-status-text")
  const torIpText = document.getElementById("tor-ip")

  if (!rateLimitInfo.id) {
    rateLimitInfo.id = "rate-limit-info"
    rateLimitInfo.className = "error-box rate-limit-error"
    rateLimitInfo.style.display = "none"
    if (errorMessage && errorMessage.parentNode) {
      errorMessage.parentNode.insertBefore(rateLimitInfo, errorMessage.nextSibling)
    } else if (loadingSpinner && loadingSpinner.parentNode) {
      loadingSpinner.parentNode.insertBefore(rateLimitInfo, loadingSpinner.nextSibling)
    }
  }

  // Debug info
  console.log("Search form:", searchForm)
  console.log("URL input:", urlInput)
  console.log("Search button:", searchButton)

  // Initialize Tor status
  updateTorStatus()

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

  // Handle Tor toggle button
  if (torToggleBtn) {
    torToggleBtn.addEventListener("click", () => {
      const currentState = torToggleBtn.getAttribute("data-enabled") === "true"
      toggleTor(!currentState)
    })
  }

  // Handle Tor rotate IP button
  if (torRotateBtn) {
    torRotateBtn.addEventListener("click", () => {
      rotateTorIp()
    })
  }

  // Function to toggle Tor
  function toggleTor(enable) {
    if (torToggleBtn) {
      torToggleBtn.disabled = true
      torToggleBtn.textContent = enable ? "Enabling Tor..." : "Disabling Tor..."
    }

    fetch("/api/tor/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enable }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Tor toggle response:", data)
        if (data.success) {
          updateTorStatus()
        } else {
          showError(data.message || "Error toggling Tor")
        }
      })
      .catch((error) => {
        console.error("Error toggling Tor:", error)
        showError("Error toggling Tor: " + error.message)
      })
      .finally(() => {
        if (torToggleBtn) {
          torToggleBtn.disabled = false
        }
      })
  }

  // Function to rotate Tor IP
  function rotateTorIp() {
    if (torRotateBtn) {
      torRotateBtn.disabled = true
      torRotateBtn.textContent = "Rotating IP..."
    }

    fetch("/api/tor/rotate")
      .then((response) => response.json())
      .then((data) => {
        console.log("Tor rotate response:", data)
        if (data.success) {
          if (torIpText) {
            torIpText.textContent = data.ip
          }
          if (torRotateBtn) {
            torRotateBtn.textContent = "IP Rotated!"
            setTimeout(() => {
              torRotateBtn.textContent = "Rotate IP"
              torRotateBtn.disabled = false
            }, 2000)
          }
        } else {
          showError(data.message || "Error rotating Tor IP")
          if (torRotateBtn) {
            torRotateBtn.textContent = "Rotate IP"
            torRotateBtn.disabled = false
          }
        }
      })
      .catch((error) => {
        console.error("Error rotating Tor IP:", error)
        showError("Error rotating Tor IP: " + error.message)
        if (torRotateBtn) {
          torRotateBtn.textContent = "Rotate IP"
          torRotateBtn.disabled = false
        }
      })
  }

  // Function to update Tor status
  function updateTorStatus() {
    if (!torStatusContainer) return

    fetch("/api/tor/status")
      .then((response) => response.json())
      .then((data) => {
        console.log("Tor status response:", data)

        if (torToggleBtn) {
          torToggleBtn.setAttribute("data-enabled", data.enabled)
          torToggleBtn.textContent = data.enabled ? "Disable Tor" : "Enable Tor"
        }

        if (torStatusText) {
          if (data.status === "connected") {
            torStatusText.textContent = "Connected"
            torStatusText.className = "status-connected"
          } else if (data.status === "error") {
            torStatusText.textContent = "Error"
            torStatusText.className = "status-error"
          } else {
            torStatusText.textContent = "Disabled"
            torStatusText.className = "status-disabled"
          }
        }

        if (torIpText && data.ip) {
          torIpText.textContent = data.ip
        } else if (torIpText) {
          torIpText.textContent = "N/A"
        }

        if (torRotateBtn) {
          torRotateBtn.disabled = data.status !== "connected"
        }

        torStatusContainer.style.display = "block"
      })
      .catch((error) => {
        console.error("Error getting Tor status:", error)
        if (torStatusContainer) {
          torStatusContainer.style.display = "none"
        }
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
    if (rateLimitInfo) rateLimitInfo.style.display = "none"

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

        // Update Tor status if using Tor
        if (data.using_tor) {
          updateTorStatus()
        }

        if (data.success) {
          displayVideoInfo(data)
        } else {
          // Check if it's a rate limiting issue
          if (data.rate_limited) {
            showRateLimitError(data.error, data.details, data.using_tor)
          } else {
            showError(data.error || "Error retrieving video information")
          }
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
                    ${
                      data.using_tor
                        ? `<p class="tor-info">Using Tor with IP: <span class="tor-ip">${data.tor_ip || "Unknown"}</span></p>`
                        : ""
                    }
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

              // Update Tor status if using Tor
              if (data.using_tor) {
                updateTorStatus()
              }
            } else {
              // Check if it's a rate limiting issue
              if (data.rate_limited) {
                showRateLimitError(data.error, data.details, data.using_tor)
              } else {
                showError(data.error || "Error processing download")
              }
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
    if (rateLimitInfo) rateLimitInfo.style.display = "none"
  }

  // Show rate limit error function
  function showRateLimitError(message, details, usingTor) {
    console.error("Rate limit error:", message, details)

    if (rateLimitInfo) {
      let torMessage = ""
      if (usingTor) {
        torMessage = `
          <div class="tor-active">
            <p>✅ Tor proxy is active and automatically rotating IPs every 10 seconds.</p>
            <p>Please try again in a few seconds as the system rotates to a new IP address.</p>
            <button id="manual-rotate-ip" class="action-button">Manually Rotate IP Now</button>
          </div>
        `
      } else {
        torMessage = `
          <div class="tor-inactive">
            <p>❌ Tor proxy is not active. Enable Tor to bypass rate limiting.</p>
            <button id="enable-tor-btn" class="action-button">Enable Tor Proxy</button>
          </div>
        `
      }

      rateLimitInfo.innerHTML = `
        <h3>YouTube Rate Limiting Detected</h3>
        <p>${message}</p>
        ${torMessage}
        <div class="solutions">
          <h4>Additional Solutions:</h4>
          <ul>
            <li>Wait a few minutes before trying again</li>
            <li>Update yt-dlp to the latest version <button id="update-yt-dlp-btn" class="small-button">Update Now</button></li>
            <li>Try a different YouTube video</li>
          </ul>
        </div>
        <div class="details-toggle">
          <button id="show-error-details" class="small-button">Show Technical Details</button>
          <div id="error-details" style="display: none;">
            <pre>${details || "No additional details available"}</pre>
          </div>
        </div>
      `
      rateLimitInfo.style.display = "block"

      // Add event listener for the "Show Technical Details" button
      const showDetailsBtn = document.getElementById("show-error-details")
      if (showDetailsBtn) {
        showDetailsBtn.addEventListener("click", function () {
          const errorDetails = document.getElementById("error-details")
          if (errorDetails) {
            if (errorDetails.style.display === "none") {
              errorDetails.style.display = "block"
              this.textContent = "Hide Technical Details"
            } else {
              errorDetails.style.display = "none"
              this.textContent = "Show Technical Details"
            }
          }
        })
      }

      // Add event listener for the "Update Now" button
      const updateBtn = document.getElementById("update-yt-dlp-btn")
      if (updateBtn) {
        updateBtn.addEventListener("click", function () {
          this.disabled = true
          this.textContent = "Updating..."

          fetch("/update-yt-dlp")
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                this.textContent = `Updated to v${data.version}`
                alert(`yt-dlp updated successfully to version ${data.version}. Please try your download again.`)
              } else {
                this.textContent = "Update Failed"
                alert(`Failed to update yt-dlp: ${data.error}`)
              }
            })
            .catch((error) => {
              console.error("Error updating yt-dlp:", error)
              this.textContent = "Update Failed"
              alert(`Error updating yt-dlp: ${error.message}`)
            })
            .finally(() => {
              setTimeout(() => {
                this.disabled = false
                this.textContent = "Update Now"
              }, 5000)
            })
        })
      }

      // Add event listener for the "Enable Tor Proxy" button
      const enableTorBtn = document.getElementById("enable-tor-btn")
      if (enableTorBtn) {
        enableTorBtn.addEventListener("click", function () {
          this.disabled = true
          this.textContent = "Enabling Tor..."

          toggleTor(true)
        })
      }

      // Add event listener for the "Manually Rotate IP" button
      const manualRotateBtn = document.getElementById("manual-rotate-ip")
      if (manualRotateBtn) {
        manualRotateBtn.addEventListener("click", function () {
          this.disabled = true
          this.textContent = "Rotating IP..."

          rotateTorIp()

          setTimeout(() => {
            this.disabled = false
            this.textContent = "Manually Rotate IP Now"
          }, 3000)
        })
      }
    } else {
      showError(message)
    }

    if (videoInfoContainer) videoInfoContainer.style.display = "none"
    if (loadingSpinner) loadingSpinner.style.display = "none"
    if (errorMessage) errorMessage.style.display = "none"
  }

  // Set up periodic Tor status updates if Tor is enabled
  setInterval(updateTorStatus, 10000) // Update every 10 seconds

  // Test function to verify JavaScript is working
  console.log("JavaScript initialized successfully")

  // Add a visible indicator that JS is working
  const jsIndicator = document.createElement("div")
  jsIndicator.style.display = "none" // Hidden by default, but exists in DOM
  jsIndicator.id = "js-working-indicator"
  document.body.appendChild(jsIndicator)
})
