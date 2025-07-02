#!/bin/bash
set -e

# Pre-release validation script
# Ensures all prerequisites are met before release

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

echo "🔍 Pre-release validation checklist"

# Change to project root
cd "$PROJECT_ROOT"

# Check Go tests
echo "Running Go tests..."
if go test ./...; then
    log_info "All Go tests pass"
else
    log_error "Go tests failed"
    exit 1
fi

# Check Docker build
echo "Testing Docker build..."
if docker build -t whisper-hub:validation-test .; then
    log_info "Docker build successful"
else
    log_error "Docker build failed"
    exit 1
fi

# Test Docker image
echo "Testing Docker image functionality..."

# Test FFmpeg availability
if docker run --rm whisper-hub:validation-test ffmpeg -version > /dev/null 2>&1; then
    log_info "FFmpeg: Available"
else
    log_error "FFmpeg: Not available"
    exit 1
fi

# Test image can start (timeout expected)
echo "Testing server startup..."
if timeout 5s docker run --rm -e OPENAI_API_KEY=test whisper-hub:validation-test >/dev/null 2>&1; then
    log_warn "Server didn't timeout as expected"
else
    log_info "Server start: OK (expected timeout)"
fi

# Check image size
SIZE=$(docker image inspect whisper-hub:validation-test --format='{{.Size}}')
SIZE_MB=$((SIZE / 1024 / 1024))
echo "Image size: ${SIZE_MB}MB"
if [ $SIZE_MB -gt 100 ]; then
    log_warn "Image size larger than expected (${SIZE_MB}MB > 100MB)"
else
    log_info "Image size acceptable: ${SIZE_MB}MB"
fi

# Check security (basic)
echo "Basic security checks..."
ROOT_USER=$(docker run --rm whisper-hub:validation-test whoami 2>/dev/null || echo "unknown")
if [[ "$ROOT_USER" == "root" ]]; then
    log_warn "Image runs as root user"
else
    log_info "Image runs as non-root user: $ROOT_USER"
fi

# Cleanup test image
docker rmi whisper-hub:validation-test >/dev/null 2>&1

# Check git status
if [[ -n "$(git status --porcelain)" ]]; then
    log_error "Working directory not clean"
    git status --porcelain
    exit 1
else
    log_info "Working directory clean"
fi

# Check required environment (if running in CI)
if [[ "$CI" == "true" ]]; then
    if [[ -z "$DOCKER_HUB_TOKEN" ]]; then
        log_error "DOCKER_HUB_TOKEN not set"
        exit 1
    else
        log_info "Required CI environment variables set"
    fi
fi

# Check for potential secrets in code
echo "Checking for potential secrets..."
SECRET_PATTERNS=("password" "secret" "key" "token" "api_key")
FOUND_SECRETS=false

for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i "$pattern" --include="*.go" --include="*.yml" --include="*.yaml" . | grep -v "// " | grep -v "test" | grep -q .; then
        log_warn "Found potential secret pattern: $pattern"
        FOUND_SECRETS=true
    fi
done

if [[ "$FOUND_SECRETS" == "false" ]]; then
    log_info "No obvious secrets found in code"
fi

# Check documentation is up to date
echo "Checking documentation..."
if [[ -f "README.md" ]] && [[ -f "docs/DOCKER_RELEASE.md" ]]; then
    log_info "Required documentation files present"
else
    log_warn "Some documentation files missing"
fi

# Check scripts are executable
echo "Checking script permissions..."
if [[ -x "scripts/ci/release.sh" ]]; then
    log_info "Release script is executable"
else
    log_warn "Release script is not executable"
    chmod +x scripts/ci/release.sh
fi

# Final validation
echo ""
log_info "All validation checks completed successfully"
echo "🚀 Ready for release!"