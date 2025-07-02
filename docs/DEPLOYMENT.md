# 🐳 Docker Deployment Guide

Privacy-first transcription service with enterprise-grade security! Deploy with Docker in under 5 minutes.

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

### Option 3: Portainer Deployment 🐳

**Easiest GUI-based deployment!** Perfect for Portainer users:

1. **Open Portainer** web interface
2. Navigate to **Stacks** → **Add stack**
3. **Name your stack**: `whisper-hub`
4. **Paste this docker-compose.yml**:

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

5. **Replace** `sk-your-openai-api-key` with your actual OpenAI API key
6. **Click** "Deploy the stack"
7. **Access** at `http://your-server:8080`

**Portainer Benefits:**
- Visual stack management
- Easy updates via GUI
- Built-in monitoring
- Log viewing interface
- Resource usage graphs

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

**Enterprise-Grade Security Features:**
- ✅ **CSRF protection** - secure token validation on all forms
- ✅ **XSS prevention** - comprehensive input sanitization
- ✅ **Content Security Policy** - strict script execution controls
- ✅ **Rate limiting** - protection against abuse and DDoS
- ✅ **AES-GCM encryption** - client-side data protection
- ✅ **Input validation** - whitelist-based security controls
- ✅ **Security headers** - comprehensive HTTP security headers

**Infrastructure Security:**
- ✅ **Non-root execution** (UID 1001)
- ✅ **No new privileges** flag set
- ✅ **Memory limits** enforced
- ✅ **Automatic file cleanup** (including converted video files)
- ✅ **File validation** with corruption detection
- ✅ **Size limits** (100MB audio, 2GB video)
- ✅ **OpenAI compliance** (25MB converted audio limit)
- ✅ **CORS middleware** for browser compatibility

**Privacy Protection:**
- ✅ **Zero server-side storage** - transcriptions never saved to server
- ✅ **Client-side encryption** - history encrypted before localStorage
- ✅ **Incognito mode** - option for zero data persistence
- ✅ **GDPR/CCPA compliance** - full data portability
- ⚠️ **API key in environment** (consider Docker secrets for production)

## 🔄 Updates

### Docker Compose
```bash
docker-compose pull
docker-compose up -d
```

### Portainer
1. Navigate to **Stacks** → **whisper-hub**
2. Click **Editor** tab
3. Update the image tag if needed: `sighadd/whisper-hub:latest`
4. Click **Update the stack**

### Manual Container Updates
```bash
# Pull latest image
docker pull sighadd/whisper-hub:latest

# Stop and remove old container
docker stop whisper-hub
docker rm whisper-hub

# Run new container
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-your-actual-api-key-here \
  sighadd/whisper-hub:latest
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

### Browser compatibility issues
**Firefox:** Built-in CORS middleware handles cross-origin restrictions automatically.
**If transcribe button stays disabled:** Clear browser cache and reload page.
**Mixed content warnings:** Use HTTPS or access via localhost instead of IP address.

## 🎯 Perfect for:
- **Home labs** and personal servers
- **Small teams** requiring privacy-first transcription
- **GDPR-compliant** organizations needing data sovereignty
- **Security-focused** environments requiring enterprise-grade protection
- **Privacy-conscious** users wanting zero cloud storage
- **Local AI workflows** and automation
- **Homelab enthusiasts** wanting production-ready security