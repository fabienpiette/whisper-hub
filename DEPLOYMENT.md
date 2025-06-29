# 🐳 Docker Deployment Guide

Perfect for self-hosting! Deploy with Docker in under 5 minutes.

## 🚀 Quick Start Options

### Option 1: Pre-built Image (Fastest ⚡)

```bash
# Run directly from Docker Hub
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-your-actual-api-key-here \
  sighadd/whisper-hub:latest
```

### Option 2: Docker Compose (Full Setup)

1. **Clone and deploy**:
```bash
git clone <your-repo-url>
cd whisper-hub

# Set your API key and deploy in one command
OPENAI_API_KEY=sk-your-actual-api-key-here docker-compose up -d
```

2. **Access**: Visit `http://localhost:8080`

That's it! 🎉

### Alternative: Export Environment Variable

```bash
# Export the variable first
export OPENAI_API_KEY=sk-your-actual-api-key-here

# Then deploy
docker-compose up -d
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *required* | Your OpenAI API key |
| `PORT` | `8080` | Server port |
| `UPLOAD_MAX_SIZE` | `2147483648` | Max upload size (2GB for videos) |

### Custom Port

To run on a different port (e.g., 3000):
```yaml
# docker-compose.yml
ports:
  - "3000:8080"
```

### Using .env File (Optional)

If you prefer using a `.env` file for local development:
```bash
# Create .env file
echo "OPENAI_API_KEY=sk-your-actual-api-key-here" > .env

# Docker Compose will automatically pick it up
docker-compose up -d
```

### Behind Reverse Proxy

Example Nginx config:
```nginx
location /transcribe/ {
    proxy_pass http://localhost:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 2G;  # Support video files
}
```

## 🏗️ Docker Image Options

### Using Pre-built Image
```bash
# Pull latest image
docker pull sighadd/whisper-hub:latest

# Run container
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-your-actual-api-key-here \
  sighadd/whisper-hub:latest
```

### Manual Build (Development)
```bash
# Build image locally
docker build -t whisper-hub:local .

# Run container
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-your-actual-api-key-here \
  whisper-hub:local
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:8080/health
```

### Metrics Endpoint
```bash
curl http://localhost:8080/metrics
```

### Docker Stats
```bash
docker stats whisper-hub
```

### Structured Logs
```bash
# View logs
docker-compose logs -f transcribe

# Filter by log level
docker-compose logs transcribe | jq 'select(.level=="ERROR")'

# Monitor transcription requests
docker-compose logs transcribe | jq 'select(.msg=="transcription completed successfully")'
```

## 🔒 Security Considerations

- ✅ Runs as non-root user (UID 1001)
- ✅ No new privileges
- ✅ Memory limits enforced
- ✅ Temporary file cleanup (including converted video files)
- ✅ Audio/video file type validation with corruption detection
- ✅ File size limits (100MB audio, 2GB video)
- ✅ OpenAI API compliance (25MB converted audio limit)
- ⚠️ API key in environment (consider Docker secrets for production)

## 🔄 Updates

```bash
docker-compose pull
docker-compose up -d
```

## 🧹 Cleanup

```bash
docker-compose down -v  # Removes containers and volumes
docker image prune      # Clean unused images
```

## 📈 Resource Usage

- **Memory**: ~50-200MB idle, ~300-500MB during transcription
- **Storage**: Minimal (temporary files auto-deleted)
- **CPU**: Burst during upload, idle otherwise

## 🔧 Troubleshooting

### Container won't start
```bash
docker-compose logs transcribe
```

### File upload fails
Check file size limits and disk space:
```bash
docker exec whisper-hub df -h
```

### API errors
Verify your OpenAI API key has credits and Whisper access.

## 🎯 Perfect for:
- Home labs
- Small teams
- Privacy-focused transcription
- Local AI workflows