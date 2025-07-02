# Docker Registry Management

Complete guide for managing the Docker Hub registry `sighadd/whisper-hub` including maintenance, security, and optimization.

## Registry Overview

**Repository:** `sighadd/whisper-hub`
**URL:** https://hub.docker.com/repository/docker/sighadd/whisper-hub
**Access:** Public repository with private management

## Repository Configuration

### Basic Settings

#### Repository Information
```yaml
Repository Name: whisper-hub
Namespace: sighadd
Visibility: Public
Description: Privacy-first self-hosted audio transcription using OpenAI Whisper API
Categories: 
  - Developer Tools
  - Audio/Video
  - Self-Hosted
```

#### Supported Tags
```bash
# Version tags
latest          # Always points to the latest stable release
v1.2.3          # Specific version releases
1.2.3           # Semantic version without 'v' prefix
1.2             # Major.minor version
1               # Major version only

# Special tags
edge            # Latest development build (optional)
rc              # Release candidates (v1.2.3-rc1)
beta            # Beta releases (v1.2.3-beta1)
```

### Repository Description Template

```markdown
# Whisper Hub - Privacy-First Audio Transcription

Self-hosted web-based audio and video transcription using OpenAI's Whisper API. 
Enterprise-grade security with modern UX. Perfect for /r/selfhosted!

## 🚀 Quick Start

```bash
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=your-key-here \
  sighadd/whisper-hub:latest
```

Access at http://localhost:8080

## 📋 Supported Formats

**Audio:** MP3, WAV, M4A, OGG, FLAC, AAC (up to 100MB)
**Video:** MP4, AVI, MOV, MKV, WEBM, FLV (up to 2GB, auto-converted)

## 🔒 Privacy Features

- Zero server-side storage
- Client-side encryption
- GDPR/CCPA compliance
- Enterprise security

## 📊 Platforms

- `linux/amd64` - Intel/AMD 64-bit
- `linux/arm64` - ARM 64-bit, Apple Silicon
- `linux/arm/v7` - ARM 32-bit, Raspberry Pi

## 📖 Documentation

- [GitHub Repository](https://github.com/fabienpiette/whisper-hub)
- [Deployment Guide](https://github.com/fabienpiette/whisper-hub/blob/main/docs/DEPLOYMENT.md)
- [Docker Guide](https://github.com/fabienpiette/whisper-hub/blob/main/docs/DOCKER_RELEASE.md)

## 🏷️ Tags

`whisper` `transcription` `openai` `privacy` `self-hosted` `docker` `audio` `video` `htmx` `golang`
```

## Tag Management Strategy

### Version Tagging Best Practices

#### Semantic Versioning
```bash
# Major version (breaking changes)
v1.0.0 → v2.0.0
sighadd/whisper-hub:1 → sighadd/whisper-hub:2

# Minor version (new features)
v1.1.0 → v1.2.0
sighadd/whisper-hub:1.1 → sighadd/whisper-hub:1.2

# Patch version (bug fixes)
v1.1.1 → v1.1.2
sighadd/whisper-hub:1.1.1 → sighadd/whisper-hub:1.1.2
```

#### Tag Lifecycle Management
```bash
# Keep these tags permanently
latest                    # Always latest stable
v[major].[minor].[patch] # Specific versions
[major].[minor].[patch]  # Without v prefix
[major].[minor]          # Minor version series
[major]                  # Major version series

# Temporary tags (remove after stable release)
v1.2.3-rc1              # Release candidates
v1.2.3-beta1            # Beta versions
edge                     # Development builds
```

### Automated Tag Cleanup

Create `scripts/ci/cleanup-tags.sh`:

```bash
#!/bin/bash
set -e

# Cleanup old development tags from Docker Hub
# Note: This requires Docker Hub API or manual intervention

echo "🧹 Docker Hub tag cleanup guidance"
echo ""
echo "Tags to consider removing:"
echo "- Development tags older than 30 days"
echo "- RC tags after stable release"
echo "- Beta tags after stable release"
echo ""
echo "Manual cleanup required via Docker Hub web interface:"
echo "1. Go to https://hub.docker.com/repository/docker/sighadd/whisper-hub/tags"
echo "2. Filter by tag pattern (rc, beta, edge)"
echo "3. Select old tags and delete"
echo ""
echo "Keep these tag patterns:"
echo "- latest"
echo "- v[0-9]*.[0-9]*.[0-9]*"
echo "- [0-9]*.[0-9]*.[0-9]*"
echo "- [0-9]*.[0-9]*"
echo "- [0-9]*"
```

## Security Management

### Access Control

#### Docker Hub Account Security
```bash
# Enable two-factor authentication
# Use access tokens instead of passwords
# Regularly rotate access tokens
# Monitor access logs
```

#### Repository Permissions
```yaml
Repository Access:
  Owner: sighadd (full access)
  Collaborators: 
    - Add team members as needed
    - Use least privilege principle
    - Regular access review

Token Permissions:
  Read: For CI/CD pulls
  Write: For CI/CD pushes  
  Delete: Only for maintenance
```

### Vulnerability Management

#### Image Scanning Setup
```yaml
# Enable automated vulnerability scanning
Security Scanning: enabled
Scan on Push: enabled
Scan Schedule: daily
Alert Threshold: medium

# Integration with CI/CD
Pre-push Scanning: enabled
Block on High/Critical: enabled
```

#### Scan Results Management
```bash
# Monitor vulnerability reports
# Update base images regularly
# Address critical vulnerabilities within 24h
# Address high vulnerabilities within 7 days
# Document security decisions
```

### Security Monitoring

Create monitoring script `scripts/ci/security-check.sh`:

```bash
#!/bin/bash
set -e

# Security monitoring for Docker images

IMAGE="sighadd/whisper-hub:latest"
echo "🔍 Security analysis for $IMAGE"

# Pull latest image
docker pull "$IMAGE"

# Basic security checks
echo "📊 Image analysis:"

# Check if running as root
ROOT_CHECK=$(docker run --rm "$IMAGE" whoami 2>/dev/null || echo "unknown")
if [[ "$ROOT_CHECK" == "root" ]]; then
    echo "⚠️  Warning: Image runs as root user"
else
    echo "✅ Image runs as non-root user: $ROOT_CHECK"
fi

# Check for common vulnerabilities (if tools available)
if command -v trivy &> /dev/null; then
    echo "🛡️  Running Trivy security scan..."
    trivy image --severity HIGH,CRITICAL "$IMAGE"
fi

# Check image size
SIZE=$(docker image inspect "$IMAGE" --format='{{.Size}}')
SIZE_MB=$((SIZE / 1024 / 1024))
echo "📦 Image size: ${SIZE_MB}MB"

# Check for secrets in layers (basic check)
echo "🔐 Checking for potential secrets..."
docker history --no-trunc "$IMAGE" | grep -i -E "(password|secret|key|token)" || echo "✅ No obvious secrets found in history"

echo "✅ Security check completed"
```

## Performance Optimization

### Image Size Optimization

#### Multi-stage Build Best Practices
```dockerfile
# Example optimized Dockerfile structure
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o transcribe-server cmd/server/main.go

FROM alpine:3.18
RUN apk --no-cache add ffmpeg wget
WORKDIR /app
COPY --from=builder /app/transcribe-server .
COPY web/ web/
USER 1001:1001
EXPOSE 8080
CMD ["./transcribe-server"]
```

#### Size Monitoring
```bash
# Track image size over time
# Target: < 50MB for optimal download experience
# Alert if size increases > 20% between versions
# Regular base image updates
```

### Build Performance

#### Build Cache Strategy
```yaml
# GitHub Actions cache configuration
cache-from: type=gha
cache-to: type=gha,mode=max

# Multi-stage build caching
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

RUN --mount=type=cache,target=/root/.cache/go-build \
    go build -o app
```

#### Parallel Builds
```bash
# Build multiple platforms in parallel
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --cache-from type=gha \
  --cache-to type=gha,mode=max \
  --push \
  .
```

## Registry Analytics

### Metrics Tracking

#### Key Performance Indicators
```yaml
Download Metrics:
  - Total pulls per month
  - Unique users
  - Geographic distribution
  - Platform distribution (amd64 vs arm64 vs arm/v7)

Version Adoption:
  - Latest vs specific version usage
  - Version upgrade patterns
  - Long-term support version usage

Security Metrics:
  - Vulnerability scan results
  - Time to patch critical issues
  - Security alerts response time
```

#### Monitoring Dashboard
```bash
# Docker Hub provides basic analytics
# Access via: https://hub.docker.com/repository/docker/sighadd/whisper-hub/analytics

# Key metrics to monitor:
# - Pull count trends
# - Platform distribution
# - Tag usage patterns
# - Geographic distribution
```

### Usage Analytics Script

Create `scripts/ci/registry-analytics.sh`:

```bash
#!/bin/bash
set -e

# Docker Hub analytics summary
# Note: Requires Docker Hub API access or manual data collection

echo "📈 Docker Registry Analytics Summary"
echo "Repository: sighadd/whisper-hub"
echo "Date: $(date)"
echo ""

# Basic checks that can be automated
echo "🏷️  Available tags:"
docker search sighadd/whisper-hub --limit 1 --format "table {{.Name}}\t{{.Description}}" 2>/dev/null || echo "Search not available"

echo ""
echo "📦 Latest image info:"
docker pull sighadd/whisper-hub:latest &>/dev/null
docker image inspect sighadd/whisper-hub:latest --format='
Image: {{.RepoTags}}
Size: {{.Size}} bytes
Created: {{.Created}}
Architecture: {{.Architecture}}
OS: {{.Os}}
' 2>/dev/null

echo ""
echo "🔍 Multi-platform support:"
docker buildx imagetools inspect sighadd/whisper-hub:latest 2>/dev/null | grep -A 10 "Manifest" || echo "Multi-platform info not available"

echo ""
echo "📊 Manual analytics check required:"
echo "Visit: https://hub.docker.com/repository/docker/sighadd/whisper-hub/analytics"
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Tasks
```bash
# Check security scan results
# Review download metrics
# Monitor for new base image updates
# Check for deprecated tag usage
```

#### Monthly Tasks
```bash
# Security audit of access permissions
# Review and clean up old development tags
# Update repository description if needed
# Performance analysis and optimization
```

#### Quarterly Tasks
```bash
# Comprehensive security review
# Access token rotation
# Registry analytics review
# Documentation updates
```

### Emergency Procedures

#### Critical Security Vulnerability Response
```bash
# 1. Immediate response (within 2 hours)
echo "🚨 Critical vulnerability detected"

# Pull affected image
docker pull sighadd/whisper-hub:affected-version

# Scan for specific vulnerability
trivy image --severity CRITICAL sighadd/whisper-hub:affected-version

# 2. Patch development (within 24 hours)
# Create hotfix branch
git checkout -b hotfix/security-YYYY-MM-DD

# Apply security patches
# Update dependencies
# Run security scans

# 3. Emergency release
./scripts/ci/release.sh v1.2.4

# 4. Communication
echo "📢 Security advisory"
echo "Affected versions: X.Y.Z"
echo "Fixed in version: A.B.C"
echo "Action required: Update immediately"
```

#### Registry Outage Response
```bash
# Backup critical images to alternative registry
docker pull sighadd/whisper-hub:latest
docker tag sighadd/whisper-hub:latest backup-registry/whisper-hub:latest
docker push backup-registry/whisper-hub:latest

# Update documentation with alternative download methods
# Communicate status to users
# Monitor Docker Hub status
```

### Backup and Recovery

#### Image Backup Strategy
```bash
# Regular backup of critical tags
BACKUP_REGISTRY="backup.example.com"
CRITICAL_TAGS=("latest" "1.0.0" "1.1.0" "1.2.0")

for tag in "${CRITICAL_TAGS[@]}"; do
    echo "Backing up sighadd/whisper-hub:$tag"
    docker pull "sighadd/whisper-hub:$tag"
    docker tag "sighadd/whisper-hub:$tag" "$BACKUP_REGISTRY/whisper-hub:$tag"
    docker push "$BACKUP_REGISTRY/whisper-hub:$tag"
done
```

#### Registry Migration Plan
```yaml
Migration Scenario: Docker Hub → Alternative Registry

Preparation:
  1. Export all tags and metadata
  2. Set up alternative registry
  3. Test authentication and access
  4. Prepare automation scripts

Execution:
  1. Migrate images in batches
  2. Update CI/CD pipelines
  3. Update documentation
  4. Communicate changes to users

Rollback:
  1. Revert CI/CD configurations
  2. Update documentation
  3. Monitor for issues
```

## Integration with CI/CD

### Repository Webhooks

#### Docker Hub Webhooks Setup
```yaml
# Configure webhooks for external integrations
Webhook URL: https://your-server.com/docker-webhook
Trigger Events:
  - Image pushed
  - Repository deleted
  - Security scan completed

Payload Example:
{
  "callback_url": "https://registry.hub.docker.com/u/sighadd/whisper-hub/hook/...",
  "push_data": {
    "images": ["sighadd/whisper-hub:latest"],
    "tag": "latest"
  },
  "repository": {
    "name": "whisper-hub",
    "namespace": "sighadd"
  }
}
```

#### Webhook Handler Example
```bash
#!/bin/bash
# webhook-handler.sh - Process Docker Hub webhooks

# Parse webhook payload
TAG=$(echo "$WEBHOOK_PAYLOAD" | jq -r '.push_data.tag')
REPO=$(echo "$WEBHOOK_PAYLOAD" | jq -r '.repository.repo_name')

echo "New push detected: $REPO:$TAG"

# Trigger downstream actions
if [[ "$TAG" == "latest" ]]; then
    # Update production deployment
    kubectl set image deployment/whisper-hub whisper-hub="sighadd/whisper-hub:$TAG"
fi

# Send notifications
curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"New Docker image: sighadd/whisper-hub:$TAG\"}"
```

This comprehensive registry management documentation provides everything needed to maintain a professional Docker Hub presence for your Whisper Hub project.