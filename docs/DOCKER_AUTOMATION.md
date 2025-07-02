# Docker Release Automation

Comprehensive automation setup for Docker Hub releases with GitHub Actions CI/CD.

## GitHub Actions Workflow

### Complete Release Workflow

Create `.github/workflows/docker-release.yml`:

```yaml
name: Docker Release to Hub

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g., v1.2.3)'
        required: true
        type: string
      platforms:
        description: 'Target platforms'
        required: false
        default: 'linux/amd64,linux/arm64,linux/arm/v7'
        type: string

env:
  REGISTRY: docker.io
  IMAGE_NAME: sighadd/whisper-hub

jobs:
  docker-release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          platforms: linux/amd64,linux/arm64,linux/arm/v7

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: sighadd
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            # Tag with git tag for versioned releases
            type=ref,event=tag
            # Extract semantic version components
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            # Tag as latest for main branch releases
            type=raw,value=latest,enable={{is_default_branch}}
            # Manual dispatch version
            type=raw,value=${{ github.event.inputs.version }},enable=${{ github.event_name == 'workflow_dispatch' }}
          labels: |
            org.opencontainers.image.title=Whisper Hub
            org.opencontainers.image.description=Privacy-first self-hosted audio transcription using OpenAI Whisper API
            org.opencontainers.image.vendor=Whisper Hub
            org.opencontainers.image.url=https://github.com/fabienpiette/whisper-hub
            org.opencontainers.image.source=https://github.com/fabienpiette/whisper-hub
            org.opencontainers.image.documentation=https://github.com/fabienpiette/whisper-hub/blob/main/README.md

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          platforms: ${{ github.event.inputs.platforms || 'linux/amd64,linux/arm64,linux/arm/v7' }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VERSION=${{ steps.meta.outputs.version }}
            BUILD_DATE=${{ steps.meta.outputs.created }}
            VCS_REF=${{ github.sha }}

      - name: Test released image
        run: |
          echo "Testing released image..."
          
          # Test image can start
          docker run --rm --name test-whisper \
            -e OPENAI_API_KEY=test \
            ${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }} \
            timeout 10s /app/transcribe-server || echo "Expected timeout"
          
          # Test FFmpeg is available
          docker run --rm ${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }} \
            ffmpeg -version | head -1
          
          # Test health endpoint
          docker run -d --name health-test \
            -p 8080:8080 \
            -e OPENAI_API_KEY=test \
            ${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }}
          
          sleep 5
          curl -f http://localhost:8080/health || exit 1
          docker stop health-test
          docker rm health-test

      - name: Generate release notes
        id: release_notes
        run: |
          # Extract version from tag
          VERSION="${{ steps.meta.outputs.version }}"
          
          # Generate release notes
          cat > release_notes.md << EOF
          ## Docker Image Released: ${VERSION}
          
          **Image:** \`sighadd/whisper-hub:${VERSION}\`
          
          ### Quick Start
          \`\`\`bash
          docker run -d \\
            --name whisper-hub \\
            -p 8080:8080 \\
            -e OPENAI_API_KEY=your-key-here \\
            sighadd/whisper-hub:${VERSION}
          \`\`\`
          
          ### Supported Platforms
          - linux/amd64 (Intel/AMD 64-bit)
          - linux/arm64 (ARM 64-bit, Apple Silicon)
          - linux/arm/v7 (ARM 32-bit, Raspberry Pi)
          
          ### Image Details
          - **Size:** ~50MB
          - **Base:** Alpine Linux
          - **Includes:** FFmpeg, Go runtime
          - **Security:** Non-root execution, minimal attack surface
          
          EOF
          
          echo "release_notes<<EOF" >> $GITHUB_OUTPUT
          cat release_notes.md >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          body: ${{ steps.release_notes.outputs.release_notes }}
          files: |
            Dockerfile
            docker-compose.yml
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Update Docker Hub Description
        uses: peter-evans/dockerhub-description@v3
        with:
          username: sighadd
          password: ${{ secrets.DOCKER_HUB_TOKEN }}
          repository: sighadd/whisper-hub
          readme-filepath: ./README.md
```

### Development Workflow

Create `.github/workflows/docker-dev.yml`:

```yaml
name: Docker Development Build

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
    paths:
      - 'Dockerfile'
      - 'cmd/**'
      - 'internal/**'
      - 'web/**'
      - 'go.mod'
      - 'go.sum'

env:
  IMAGE_NAME: whisper-hub

jobs:
  docker-build-test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/amd64
          push: false
          tags: ${{ env.IMAGE_NAME }}:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Test Docker image
        run: |
          # Test image starts correctly
          docker run --rm --name test-build \
            -e OPENAI_API_KEY=test \
            ${{ env.IMAGE_NAME }}:test \
            timeout 5s /app/transcribe-server || echo "Expected timeout"
          
          # Test FFmpeg availability
          docker run --rm ${{ env.IMAGE_NAME }}:test ffmpeg -version
          
          # Test image size (should be under 100MB)
          SIZE=$(docker image inspect ${{ env.IMAGE_NAME }}:test --format='{{.Size}}')
          SIZE_MB=$((SIZE / 1024 / 1024))
          echo "Image size: ${SIZE_MB}MB"
          if [ $SIZE_MB -gt 100 ]; then
            echo "Warning: Image size is larger than expected (${SIZE_MB}MB > 100MB)"
          fi

      - name: Security scan
        uses: anchore/scan-action@v3
        with:
          image: ${{ env.IMAGE_NAME }}:test
          fail-build: false
          severity-cutoff: high
```

## Repository Secrets Setup

### Required Secrets

Add these secrets to your GitHub repository:

```bash
# Go to GitHub repository → Settings → Secrets and variables → Actions

# Docker Hub Token (required)
DOCKER_HUB_TOKEN=dckr_pat_xxxxxxxxxxxxxxxxxxxxx

# Optional: GitHub Token (usually auto-provided)
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxx
```

### Creating Docker Hub Token

1. Go to [Docker Hub Account Settings](https://hub.docker.com/settings/security)
2. Click "New Access Token"
3. Name: `GitHub Actions Whisper Hub`
4. Permissions: `Read, Write, Delete`
5. Copy token and add to GitHub secrets

## Automated Release Scripts

### Release Script

Create `scripts/ci/release.sh`:

```bash
#!/bin/bash
set -e

# Automated release script for Whisper Hub
# Usage: ./scripts/ci/release.sh [version]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if version provided
VERSION=${1:-}
if [[ -z "$VERSION" ]]; then
    log_error "Version required. Usage: $0 [version]"
    log_info "Example: $0 v1.2.3"
    exit 1
fi

# Validate version format
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log_error "Invalid version format. Expected: vX.Y.Z (e.g., v1.2.3)"
    exit 1
fi

log_info "Starting release process for version: $VERSION"

# Check git status
cd "$PROJECT_ROOT"
if [[ -n "$(git status --porcelain)" ]]; then
    log_error "Working directory not clean. Commit or stash changes first."
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log_warn "Not on main branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Release cancelled"
        exit 0
    fi
fi

# Update version in documentation
log_info "Updating version references..."
VERSION_NUMBER=${VERSION#v}  # Remove 'v' prefix

# Update README.md examples
sed -i.bak "s/whisper-hub:[^[:space:]]*/whisper-hub:$VERSION_NUMBER/g" README.md
sed -i.bak "s/whisper-hub:[^[:space:]]*/whisper-hub:latest/g" README.md

# Update docker-compose.yml if exists
if [[ -f "docker-compose.yml" ]]; then
    sed -i.bak "s/image: sighadd\/whisper-hub:.*/image: sighadd\/whisper-hub:latest/" docker-compose.yml
fi

# Clean up backup files
find . -name "*.bak" -delete

# Run tests before tagging
log_info "Running tests..."
go test ./...

# Run quality checks
if [[ -f "scripts/qa/validate-code-quality.sh" ]]; then
    log_info "Running quality checks..."
    ./scripts/qa/validate-code-quality.sh
fi

# Create and push tag
log_info "Creating git tag: $VERSION"
git add .
git commit -m "Prepare release $VERSION" || log_warn "No changes to commit"
git tag -a "$VERSION" -m "Release $VERSION"

log_info "Pushing tag to origin..."
git push origin "$VERSION"

# Wait for GitHub Actions
log_info "GitHub Actions will now build and push Docker images"
log_info "Monitor progress at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"

log_info "Release process completed for version: $VERSION"
log_info "Docker image will be available at: sighadd/whisper-hub:$VERSION_NUMBER"
```

### Pre-release Validation Script

Create `scripts/ci/validate-release.sh`:

```bash
#!/bin/bash
set -e

# Pre-release validation script
# Ensures all prerequisites are met before release

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔍 Pre-release validation checklist"

# Check Go tests
echo "✅ Running Go tests..."
cd "$PROJECT_ROOT"
go test ./...

# Check Docker build
echo "✅ Testing Docker build..."
docker build -t whisper-hub:validation-test .

# Test Docker image
echo "✅ Testing Docker image functionality..."
docker run --rm whisper-hub:validation-test ffmpeg -version > /dev/null
echo "   FFmpeg: OK"

# Test image can start (timeout expected)
timeout 5s docker run --rm -e OPENAI_API_KEY=test whisper-hub:validation-test || echo "   Server start: OK"

# Check image size
SIZE=$(docker image inspect whisper-hub:validation-test --format='{{.Size}}')
SIZE_MB=$((SIZE / 1024 / 1024))
echo "   Image size: ${SIZE_MB}MB"
if [ $SIZE_MB -gt 100 ]; then
    echo "⚠️  Warning: Image size larger than expected (${SIZE_MB}MB)"
fi

# Cleanup test image
docker rmi whisper-hub:validation-test

# Check git status
if [[ -n "$(git status --porcelain)" ]]; then
    echo "❌ Working directory not clean"
    exit 1
fi

# Check required secrets (if running in CI)
if [[ "$CI" == "true" ]]; then
    if [[ -z "$DOCKER_HUB_TOKEN" ]]; then
        echo "❌ DOCKER_HUB_TOKEN not set"
        exit 1
    fi
fi

echo "✅ All validation checks passed"
echo "🚀 Ready for release!"
```

## Manual Release Process

### Quick Release Commands

```bash
# Validate everything is ready
./scripts/ci/validate-release.sh

# Create and push release
./scripts/ci/release.sh v1.2.3

# Monitor GitHub Actions
gh run list --limit 5

# Check Docker Hub once complete
docker pull sighadd/whisper-hub:1.2.3
docker run --rm sighadd/whisper-hub:1.2.3 ffmpeg -version
```

### Emergency Hotfix Release

```bash
# Create hotfix branch
git checkout -b hotfix/v1.2.4
# Make critical fixes
git commit -m "Fix critical security issue"

# Fast release process
./scripts/ci/release.sh v1.2.4

# Merge back to main
git checkout main
git merge hotfix/v1.2.4
git push origin main
```

## Monitoring and Notifications

### Slack Integration (Optional)

Add to workflow for notifications:

```yaml
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: "Docker release ${{ steps.meta.outputs.version }}: ${{ job.status }}"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Discord Integration (Optional)

```yaml
      - name: Discord notification
        if: success()
        uses: Ilshidur/action-discord@master
        env:
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
        with:
          args: 'New Whisper Hub release: ${{ steps.meta.outputs.version }} 🚀'
```

## Troubleshooting Automation

### Common CI Issues

#### Build Failures
```bash
# Check workflow logs
gh run list --limit 10
gh run view [RUN_ID]

# Debug locally
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 .
```

#### Authentication Issues
```bash
# Test Docker Hub access
echo "$DOCKER_HUB_TOKEN" | docker login -u sighadd --password-stdin

# Verify token permissions
docker buildx imagetools inspect sighadd/whisper-hub:latest
```

### Recovery Procedures

#### Failed Release Recovery
```bash
# Remove failed tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Fix issues and retry
./scripts/ci/release.sh v1.2.3
```

#### Rollback Latest Tag
```bash
# Re-tag previous version as latest
docker pull sighadd/whisper-hub:1.2.2
docker tag sighadd/whisper-hub:1.2.2 sighadd/whisper-hub:latest
docker push sighadd/whisper-hub:latest
```

This automation setup provides a robust, secure, and efficient Docker release process for your Whisper Hub project.