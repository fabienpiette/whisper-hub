# Docker Release Guide

Complete guide for releasing new versions of Whisper Hub to Docker Hub at `sighadd/whisper-hub`.

## Prerequisites

- Docker installed and running
- Docker Hub account access for `sighadd/whisper-hub` repository
- Git repository with proper tagging
- Multi-platform build capabilities (buildx)

## Release Process

### 1. Pre-Release Preparation

#### Version Planning
```bash
# Determine version type
MAJOR.MINOR.PATCH (e.g., 1.2.3)
# MAJOR: Breaking changes
# MINOR: New features (backward compatible)
# PATCH: Bug fixes (backward compatible)
```

#### Quality Assurance
```bash
# Run full test suite
go test ./...

# Run security validation
./scripts/qa/validate-code-quality.sh

# Test Docker build locally
docker build -t whisper-hub:test .

# Test image functionality
docker run --rm -e OPENAI_API_KEY=test whisper-hub:test
```

### 2. Version Tagging

#### Create Git Tag
```bash
# Set version number
VERSION="v1.2.3"

# Create annotated tag
git tag -a $VERSION -m "Release $VERSION: Brief description of changes"

# Push tag to remote
git push origin $VERSION

# Verify tag
git tag -l | grep $VERSION
```

#### Tag Naming Convention
- `v1.0.0` - Major release
- `v1.1.0` - Minor release  
- `v1.1.1` - Patch release
- `v1.2.0-rc1` - Release candidate
- `v1.2.0-beta1` - Beta release

### 3. Docker Hub Authentication

#### Login to Docker Hub
```bash
# Login interactively
docker login

# Or login with credentials
echo "$DOCKER_HUB_TOKEN" | docker login -u sighadd --password-stdin
```

#### Verify Repository Access
```bash
# Check repository exists and is accessible
docker pull sighadd/whisper-hub:latest || echo "First time setup required"
```

### 4. Multi-Platform Build Setup

#### Initialize Docker Buildx
```bash
# Create new builder instance
docker buildx create --name whisper-builder --use

# Verify builder
docker buildx inspect --bootstrap

# List supported platforms
docker buildx ls
```

#### Platform Support
Target platforms for maximum compatibility:
- `linux/amd64` (Intel/AMD 64-bit)
- `linux/arm64` (ARM 64-bit, Apple Silicon, Raspberry Pi 4+)
- `linux/arm/v7` (ARM 32-bit, Raspberry Pi 2-3)

### 5. Build and Push Process

#### Method 1: Manual Release
```bash
# Set version
VERSION="v1.2.3"
VERSION_NUMBER="1.2.3"

# Build and push multi-platform image
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag sighadd/whisper-hub:latest \
  --tag sighadd/whisper-hub:$VERSION \
  --tag sighadd/whisper-hub:$VERSION_NUMBER \
  --push \
  .

# Verify upload
docker buildx imagetools inspect sighadd/whisper-hub:$VERSION
```

#### Method 2: Automated CI/CD Release
Create `.github/workflows/docker-release.yml`:

```yaml
name: Docker Release

on:
  push:
    tags:
      - 'v*'

jobs:
  docker-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: sighadd
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: sighadd/whisper-hub
          tags: |
            type=ref,event=tag
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64,linux/arm/v7
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 6. Release Validation

#### Test Release
```bash
VERSION="v1.2.3"

# Pull and test new version
docker pull sighadd/whisper-hub:$VERSION

# Test basic functionality
docker run --rm sighadd/whisper-hub:$VERSION ffmpeg -version

# Test health endpoint
docker run -d --name test-whisper -p 8080:8080 \
  -e OPENAI_API_KEY=test \
  sighadd/whisper-hub:$VERSION

# Check health
curl http://localhost:8080/health

# Cleanup
docker stop test-whisper && docker rm test-whisper
```

#### Verify Multi-Platform Support
```bash
# Check image manifests
docker buildx imagetools inspect sighadd/whisper-hub:$VERSION

# Should show multiple platforms:
# - linux/amd64
# - linux/arm64  
# - linux/arm/v7
```

### 7. Documentation Updates

#### Update Docker Hub Description
1. Go to https://hub.docker.com/repository/docker/sighadd/whisper-hub
2. Click "Edit" 
3. Update description with new features/changes
4. Update supported tags list

#### Update Repository Documentation
```bash
# Update README.md with new version examples
# Update DEPLOYMENT.md with any deployment changes
# Update CHANGELOG.md with release notes
```

## Release Automation

### GitHub Secrets Configuration

Add to repository secrets:
```
DOCKER_HUB_TOKEN=<your-docker-hub-access-token>
```

### Automatic Tagging Strategy
```bash
# Create release branch
git checkout -b release/v1.2.3

# Make final adjustments
# Update version in documentation
# Update CHANGELOG.md

# Commit and tag
git commit -m "Prepare release v1.2.3"
git tag -a v1.2.3 -m "Release v1.2.3: Add new features"
git push origin release/v1.2.3
git push origin v1.2.3

# CI will automatically build and push Docker images
```

## Rollback Procedures

### Emergency Rollback
```bash
# Identify last good version
LAST_GOOD="v1.2.2"

# Re-tag latest to point to last good version
docker pull sighadd/whisper-hub:$LAST_GOOD
docker tag sighadd/whisper-hub:$LAST_GOOD sighadd/whisper-hub:latest
docker push sighadd/whisper-hub:latest

# Notify users of the rollback
```

### Version Removal
```bash
# Remove problematic tag (if necessary)
# Note: This requires Docker Hub web interface or API calls
# Cannot be done via Docker CLI
```

## Best Practices

### Security
- Use Docker Hub access tokens, not passwords
- Scan images for vulnerabilities before release
- Keep base images updated
- Follow principle of least privilege

### Performance
- Use multi-stage builds to minimize image size
- Leverage build cache for faster builds
- Use `.dockerignore` to exclude unnecessary files

### Reliability
- Test images on multiple platforms before release
- Maintain backward compatibility when possible
- Document breaking changes clearly
- Use semantic versioning consistently

### Monitoring
- Monitor Docker Hub download metrics
- Track image vulnerability reports
- Monitor user feedback and issues

## Troubleshooting

### Common Issues

#### Build Platform Errors
```bash
# Error: platform not supported
# Solution: Check available platforms
docker buildx ls

# Recreate builder if needed
docker buildx rm whisper-builder
docker buildx create --name whisper-builder --use
```

#### Authentication Failures
```bash
# Error: unauthorized
# Solution: Re-login with correct credentials
docker logout
docker login -u sighadd

# Verify token permissions on Docker Hub
```

#### Push Failures
```bash
# Error: repository does not exist
# Solution: Verify repository name and permissions
docker buildx imagetools inspect sighadd/whisper-hub:latest
```

### Emergency Contacts
- Docker Hub Support: https://hub.docker.com/support/
- Repository Issues: Use GitHub Issues for community support

## Monitoring and Metrics

### Track Release Success
- Docker Hub download statistics
- GitHub release download counts  
- Community feedback and issue reports
- Performance benchmarks comparison

### Post-Release Checklist
- [ ] Verify multi-platform availability
- [ ] Test deployment on different environments
- [ ] Update documentation links
- [ ] Monitor for immediate issues
- [ ] Announce release (if major/minor)
- [ ] Update dependent projects/examples

## Next Steps

After successful release:
1. Monitor Docker Hub for download activity
2. Watch for community feedback
3. Plan next release cycle
4. Update project roadmap
5. Consider security updates schedule