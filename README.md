# 🎵 Whisper Hub

Privacy-first self-hosted web-based audio transcription using OpenAI's Whisper API. Enterprise-grade security with modern UX. Perfect for /r/selfhosted!

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://hub.docker.com/r/sighadd/whisper-hub)
[![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=flat&logo=go&logoColor=white)](https://golang.org/)
[![HTMX](https://img.shields.io/badge/htmx-3366CC?style=flat&logo=htmx&logoColor=white)](https://htmx.org/)

## ✨ Features

**🚀 Deployment & Infrastructure:**
- **One-command deployment** with Docker Compose
- **Lightweight** (~50MB image, <200MB RAM)
- **Health checks** and monitoring ready
- **Universal browser support** (Chrome, Firefox, Safari compatible)

**🎨 Modern User Experience:**
- **Clean web interface** with intelligent progress tracking
- **Mobile-first responsive design** with modern CSS Grid/Flexbox
- **Drag & drop file upload** with real-time validation
- **Privacy-first history management** with search and export
- **Incognito mode** for sensitive transcriptions
- **Keyboard shortcuts** for power users (Ctrl+H, Escape)
- **Toast notifications** with real-time feedback

**🔒 Enterprise-Grade Security:**
- **CSRF protection** with secure token validation
- **XSS prevention** through comprehensive input sanitization
- **Content Security Policy** with strict script controls
- **AES-GCM encryption** for client-side data storage
- **Rate limiting** and DDoS protection
- **GDPR/CCPA compliance** with data portability

**🎬 Advanced Media Processing:**
- **Intelligent video conversion** with adaptive bitrate optimization
- **Duration-aware processing** automatically adjusts quality vs. file size
- **Smart error handling** with actionable user guidance
- **Optimized for OpenAI limits** (automatic MP3 conversion under 25MB)
- **File validation** with corruption detection

**📊 Privacy & Data Management:**
- **Zero server-side storage** - your data stays on your device
- **Encrypted history** with search, filter, and export
- **Data portability** (JSON, CSV, TXT export)
- **Automatic cleanup** and privacy controls

## 🎯 Supported Formats

**Audio:** MP3, WAV, M4A, OGG, FLAC, AAC (up to 100MB)  
**Video:** MP4, AVI, MOV, MKV, WEBM, FLV, WMV, M4V (up to 2GB)

> 📹 **Video Processing**: Videos are automatically converted to optimized MP3 format (16kHz mono, 64kbps) for efficient transcription while maintaining excellent speech quality.

## 🐳 Docker Deployment (Recommended)

Perfect for self-hosting! Deploy in under 5 minutes:

### Option 1: Pre-built Image (Fastest)
```bash
# Run directly from Docker Hub
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-your-actual-api-key-here \
  sighadd/whisper-hub:latest

# Access at http://localhost:8080
```

### Option 2: Docker Compose (Full Setup)
```bash
# Clone the repo
git clone <your-repo-url>
cd whisper-hub

# Set your OpenAI API key and deploy
OPENAI_API_KEY=sk-your-actual-api-key-here docker-compose up -d

# Access at http://localhost:8080
```

### Option 3: Portainer Deployment
You can deploy Whisper Hub easily via Portainer using the following docker-compose.yml:

```yaml
version: "3.8"

services:
  whisper-hub:
    image: sighadd/whisper-hub:latest
    container_name: whisper-hub
    restart: unless-stopped

    ports:
      - "8080:8080"

    environment:
      OPENAI_API_KEY: "sk-your-openai-api-key"  # Replace with your actual key
      PORT: 8080
      UPLOAD_MAX_SIZE: 100MB

    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s

    volumes:
      - whisper_tmp:/tmp/whisper-hub

volumes:
  whisper_tmp:
```

**Portainer Deployment Steps:**
1. Open Portainer web interface
2. Navigate to **Stacks** → **Add stack**
3. Name your stack: `whisper-hub`
4. Paste the docker-compose.yml above
5. Replace `sk-your-openai-api-key` with your actual OpenAI API key
6. Click **Deploy the stack**
7. Access at `http://your-server:8080`

**Health Check Configuration:**
- Uses reliable `wget --quiet --output-document=-` for health monitoring
- 15-second startup grace period with 30-second intervals
- Automatic container restart on health check failures

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for advanced configuration and [Docker Release Guide](docs/DOCKER_RELEASE.md) for Docker Hub releases.

## 🔧 Manual Installation

```bash
# Install dependencies
go mod tidy

# Set environment
export OPENAI_API_KEY="your-key-here"

# Run
go run cmd/server/main.go
```

## 📋 Requirements

- OpenAI API key with Whisper access
- Docker & Docker Compose (recommended)
- OR Go 1.21+ and FFmpeg for manual install

## 🔒 Privacy & Security

**Privacy-First Design:**
- **Zero server-side storage** - transcriptions never saved to server
- **Client-side encryption** - history encrypted with AES-GCM before localStorage
- **Incognito mode** - option for zero data persistence
- **GDPR/CCPA compliance** - full data portability and user control

**Enterprise Security:**
- **CSRF protection** - secure token validation on all forms
- **XSS prevention** - comprehensive input sanitization
- **Content Security Policy** - strict script execution controls
- **Rate limiting** - protection against abuse and DDoS
- **Input validation** - whitelist-based security validation
- **Secure file handling** - path traversal and injection prevention

**Infrastructure Security:**
- **Non-root container** execution with resource limits
- **Automatic file cleanup** - temporary files immediately deleted
- **API key protection** - environment variable management
- **Security headers** - comprehensive HTTP security headers
- **Video validation** - pre-processing integrity checks

## 🏠 Perfect for Self-Hosting

Ideal for:
- **Home labs** and personal use
- **Small team** transcription needs  
- **Privacy-conscious** users requiring zero cloud storage
- **Local AI workflows** and automation
- **Homelab enthusiasts** wanting enterprise-grade security
- **GDPR-compliant** organizations needing data sovereignty
- **Security-focused** environments requiring comprehensive protection

## 📊 Resource Usage

- **Image size**: ~50MB
- **RAM**: 50-200MB idle, 300-500MB during transcription
- **Storage**: Minimal (temp files auto-deleted)

## 🎬 Video Processing Features

**Intelligent Optimization:**
- ✅ **Smart format detection** and validation
- ✅ **Adaptive bitrate conversion** based on video duration
- ✅ **Pre-conversion size estimation** prevents API errors
- ✅ **Dynamic quality adjustment** (64kbps → 32kbps → 24kbps)
- ✅ **Size limit compliance** (OpenAI 25MB limit)
- ✅ **Progress tracking** that matches actual processing steps

**Technical Details:**
- **Audio extraction**: 16kHz mono, adaptive bitrate MP3
- **Bitrate selection**: 64kbps (≤1hr), 32kbps (1-2hr), 24kbps+ (2hr+)
- **Duration detection**: Uses ffprobe for precise video length analysis
- **Container support**: Includes FFmpeg with MP3 LAME encoder
- **Error handling**: Detailed feedback for corruption, size, and format issues
- **Performance**: Optimized file sizes while maintaining speech quality

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *required* | Your OpenAI API key |
| `PORT` | `8080` | Server port |
| `UPLOAD_MAX_SIZE` | `100MB` | Max audio file size (video files: 2GB) |

## 🆘 Troubleshooting

### Common Issues

**📁 "File format not supported"**
- Check that your video/audio format is in the supported list
- Try converting to MP4/MP3 before upload

**⚠️ "Video file corrupted"**
- File may be incomplete or damaged during recording
- Re-record or try a different video file

**💾 "File too large for OpenAI"**
- Videos are automatically optimized, but very long files may still exceed 25MB
- Try a shorter video or compress/trim the original

**🔑 "API key invalid"**
- Verify your OpenAI API key is correct and has Whisper access
- Check that your API quota hasn't been exceeded

**🦊 "Transcribe button stays disabled (Firefox only)"**
- Firefox has stricter cross-origin policies than Chrome/Safari
- This is automatically handled by CORS middleware
- If issues persist, try accessing via `localhost` instead of IP address
- Clear browser cache and reload the page

## 🔧 Development Scripts

The project includes organized scripts for development, CI/CD, and quality assurance:

```bash
# Setup development environment
./scripts/dev/setup.sh

# Run comprehensive test coverage analysis
./scripts/dev/test-coverage.sh

# Run performance benchmarks
./scripts/dev/run-benchmarks.sh

# Validate code quality and complexity
./scripts/qa/validate-code-quality.sh
```

**Script Organization:**
- `scripts/ci/` - Continuous integration scripts (PR validation)
- `scripts/dev/` - Development utilities (testing, benchmarks, setup)
- `scripts/qa/` - Quality assurance tools (code analysis, validation)

See `scripts/README.md` for detailed documentation.

### Debug Commands

```bash
# Check logs
docker-compose logs -f

# Health check
curl http://localhost:8080/health

# Resource usage
docker stats whisper-hub

# Test FFmpeg in container
docker-compose exec whisper-hub ffmpeg -version
```

---

⭐ **Star this repo if you find it useful for your homelab!**