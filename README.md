# 🎵 Whisper Hub

Self-hosted web-based audio transcription using OpenAI's Whisper API. Perfect for /r/selfhosted!

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://hub.docker.com/r/sighadd/whisper-hub)
[![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=flat&logo=go&logoColor=white)](https://golang.org/)
[![HTMX](https://img.shields.io/badge/htmx-3366CC?style=flat&logo=htmx&logoColor=white)](https://htmx.org/)

## ✨ Features

- 🚀 **One-command deployment** with Docker Compose
- 🌐 **Clean web interface** with intelligent progress tracking
- 📁 **Drag & drop file upload** with real-time validation
- 🎬 **Advanced video conversion** with FFmpeg optimization
- 🔒 **Secure & privacy-focused** (files auto-deleted, non-root container)
- 📱 **Mobile-friendly** responsive design
- 🚨 **Smart error handling** with actionable user guidance
- 🌐 **Universal browser support** (Chrome, Firefox, Safari compatible)
- 🏥 **Health checks** and monitoring ready
- 💾 **Lightweight** (~50MB image, <200MB RAM)
- ⚡ **Optimized for OpenAI limits** (automatic MP3 conversion)

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

See [DEPLOYMENT.md](DEPLOYMENT.md) for advanced configuration.

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

- Files processed locally and immediately deleted
- No data stored or logged
- Runs as non-root user in container with resource limits
- API key managed via environment variables
- Video files pre-validated before processing
- Automatic cleanup of temporary conversion files

## 🏠 Perfect for Self-Hosting

Ideal for:
- Home labs and personal use
- Small team transcription needs  
- Privacy-conscious users
- Local AI workflows
- Homelab enthusiasts

## 📊 Resource Usage

- **Image size**: ~50MB
- **RAM**: 50-200MB idle, 300-500MB during transcription
- **Storage**: Minimal (temp files auto-deleted)

## 🎬 Video Processing Features

**Automatic Optimization:**
- ✅ **Smart format detection** and validation
- ✅ **Efficient MP3 conversion** (70% smaller than WAV)
- ✅ **Pre-validation** for file integrity
- ✅ **Size limit compliance** (OpenAI 25MB limit)
- ✅ **Progress tracking** that matches actual processing steps

**Technical Details:**
- **Audio extraction**: 16kHz mono, 64kbps MP3
- **Container support**: Includes FFmpeg with MP3 LAME encoder
- **Error handling**: Detailed feedback for corruption, size, and format issues
- **Performance**: ~0.5MB per minute of converted audio

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