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
if [[ -f "README.md" ]]; then
    sed -i.bak "s/sighadd\/whisper-hub:[0-9]*\.[0-9]*\.[0-9]*/sighadd\/whisper-hub:$VERSION_NUMBER/g" README.md
    # Ensure latest tag is also updated where appropriate
    sed -i.bak "s/sighadd\/whisper-hub:latest/sighadd\/whisper-hub:latest/g" README.md
fi

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

# Run pre-release validation if available
if [[ -f "scripts/ci/validate-release.sh" ]]; then
    log_info "Running pre-release validation..."
    ./scripts/ci/validate-release.sh
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
log_info "Docker image will be available at: sighadd/whisper-hub:latest"

# Show next steps
echo ""
log_info "Next steps:"
echo "1. Monitor GitHub Actions for build completion"
echo "2. Test the released Docker image:"
echo "   docker pull sighadd/whisper-hub:$VERSION_NUMBER"
echo "   docker run --rm sighadd/whisper-hub:$VERSION_NUMBER ffmpeg -version"
echo "3. Update any dependent projects or documentation"
echo "4. Announce the release if it's a major/minor version"