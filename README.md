# 🎬 TubeShortsGrab - YouTube Shorts Downloader

<div align="center">
  
![TubeShortsGrab Logo](https://raw.githubusercontent.com/yourusername/tubeshortsgrabs/main/static/images/logo.png)

**A powerful Flask-based web application for downloading YouTube Shorts and videos in premium quality.**

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)](https://flask.palletsprojects.com/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-2023.7.6-red.svg)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## 📑 Table of Contents

- [Features](#-features)
- [3D Interactive Demo](#-3d-interactive-demo)
- [Prerequisites](#-prerequisites)
- [Complete Installation Guide](#-complete-installation-guide)
- [Running the Application](#-running-the-application)
- [Complete Usage Guide](#-complete-usage-guide)
- [Project Structure](#-project-structure)
- [Screenshots](#-screenshots)
- [How It Works](#-how-it-works)
- [Complete API Documentation](#-complete-api-documentation)
- [Configuration Options](#-configuration-options)
- [Extending the Application](#-extending-the-application)
- [Performance Optimization](#-performance-optimization)
- [Security Considerations](#-security-considerations)
- [Complete Troubleshooting Guide](#-complete-troubleshooting-guide)
- [Maintenance and Updates](#-maintenance-and-updates)
- [Development Roadmap](#-development-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Disclaimer](#-disclaimer)
- [Support](#-support)

## ✨ Features

- 🚀 **High-Performance Downloads**: Optimized for speed and reliability
- 🎥 **Multiple Format Support**: Download in MP4 HD, MP4 SD, or MP3 audio
- 📱 **Responsive Design**: Works perfectly on desktop and mobile devices
- 🔒 **No Registration**: No account creation or personal information required
- 🎨 **Beautiful UI**: Clean, intuitive interface for the best user experience
- 🔄 **Regular & Shorts Support**: Works with both YouTube Shorts and standard videos
- 🛡️ **Server-Side Processing**: Powered by yt-dlp for maximum compatibility
- 🔄 **Automatic Cleanup**: Temporary files are removed after download
- 📊 **Error Handling**: Comprehensive error handling and user feedback
- 🌐 **Multi-page Navigation**: Clean routing for all pages (About, FAQ, Contact, etc.)
- 📝 **Contact Form**: Built-in contact form with server-side validation
- 📱 **Mobile-First Design**: Optimized for all screen sizes and devices

## 🌟 3D Interactive Demo

Our application features a stunning 3D interactive demo on the homepage that showcases the download process in an immersive environment. The 3D visualization helps users understand how the application works:

1. **Input Visualization**: 3D representation of the URL input process
2. **Processing Animation**: Animated 3D model showing the conversion process
3. **Format Selection**: Interactive 3D buttons for format selection
4. **Download Visualization**: 3D animation of the completed download

The 3D elements are built using Three.js and are optimized for performance across all devices. The 3D demo automatically falls back to a 2D experience on devices without WebGL support.

### 3D Technical Specifications

- **Rendering Engine**: Three.js r140
- **Model Format**: glTF 2.0
- **Polygon Count**: Optimized models (<10k polygons each)
- **Textures**: Compressed (WebP format)
- **Lighting**: Real-time PBR lighting with ambient occlusion
- **Animation**: GSAP for smooth transitions
- **Performance**: 60+ FPS on modern devices

## 📋 Prerequisites

- **Python 3.7+**: Required for running the Flask application
- **FFmpeg**: Required for audio extraction and video processing
- **Modern Web Browser**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **WebGL Support**: For 3D features (falls back gracefully if not available)
- **Minimum Hardware**:
  - 2GB RAM
  - Dual-core processor
  - 500MB free disk space
  - Basic GPU for 3D visualization

## 🔧 Complete Installation Guide

### System-Specific Installation

<details>
<summary><b>Windows Installation</b></summary>

1. **Install Python 3.7+**:
   - Download from [python.org](https://www.python.org/downloads/windows/)
   - During installation, check "Add Python to PATH"
   - Verify installation: `python --version`

2. **Install Git** (optional):
   - Download from [git-scm.com](https://git-scm.com/download/win)
   - Use default installation options
   - Verify installation: `git --version`

3. **Install FFmpeg**:
   - Download from [ffmpeg.org](https://ffmpeg.org/download.html)
   - Extract the files to a folder (e.g., `C:\ffmpeg`)
   - Add to PATH:
     - Right-click on "This PC" → Properties → Advanced system settings
     - Click "Environment Variables"
     - Under "System variables", select "Path" and click "Edit"
     - Click "New" and add the path to the FFmpeg bin folder (e.g., `C:\ffmpeg\bin`)
     - Click "OK" on all dialogs
   - Verify installation: `ffmpeg -version`

4. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/tubeshortsgrabs.git
   cd tubeshortsgrabs# YTShortPro
