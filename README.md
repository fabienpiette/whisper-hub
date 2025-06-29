# 🎵 Whisper Hub

Self-hosted web-based audio transcription using OpenAI's Whisper API. Perfect for /r/selfhosted!

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=flat&logo=go&logoColor=white)](https://golang.org/)
[![HTMX](https://img.shields.io/badge/htmx-3366CC?style=flat&logo=htmx&logoColor=white)](https://htmx.org/)

## ✨ Features

- 🚀 **One-command deployment** with Docker Compose
- 🌐 **Clean web interface** with real-time progress
- 📁 **Drag & drop file upload** 
- 🔒 **Secure & privacy-focused** (files auto-deleted)
- 📱 **Mobile-friendly** responsive design
- 🏥 **Health checks** and monitoring ready
- 💾 **Lightweight** (~50MB image, <200MB RAM)

## 🎯 Supported Formats

**Audio:** MP3, WAV, M4A, OGG, FLAC, AAC (up to 100MB)  
**Video:** MP4, AVI, MOV, MKV, WEBM, FLV, WMV, M4V (up to 2GB)

## 🐳 Docker Deployment (Recommended)

Perfect for self-hosting! Deploy in under 5 minutes:

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
- OR Go 1.21+ for manual install

## 🔒 Privacy & Security

- Files processed locally and immediately deleted
- No data stored or logged
- Runs as non-root user in container
- API key managed via environment variables

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

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *required* | Your OpenAI API key |
| `PORT` | `8080` | Server port |
| `UPLOAD_MAX_SIZE` | `100MB` | Max audio file size (video files: 2GB) |

## 🆘 Troubleshooting

```bash
# Check logs
docker-compose logs -f

# Health check
curl http://localhost:8080/health

# Resource usage
docker stats audio-transcribe
```

---

⭐ **Star this repo if you find it useful for your homelab!**