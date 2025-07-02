#!/bin/bash
set -e

# Development Environment Setup Script
# Sets up the development environment and installs dependencies

echo "🚀 Setting up development environment..."

# Check Go installation
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21 or later."
    exit 1
fi

go_version=$(go version | awk '{print $3}' | sed 's/go//')
echo "✅ Go version: $go_version"

# Check Node.js for frontend testing
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "✅ Node.js version: $node_version"
else
    echo "⚠️  Node.js not found. Frontend tests may not work."
fi

# Install Go dependencies
echo "📦 Installing Go dependencies..."
go mod tidy
go mod verify

# Install development tools
echo "🔧 Installing development tools..."
go install github.com/fzipp/gocyclo/cmd/gocyclo@latest

# Install frontend dependencies if package.json exists
if [[ -f "package.json" ]]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Check for FFmpeg (required for video conversion)
if command -v ffmpeg &> /dev/null; then
    ffmpeg_version=$(ffmpeg -version | head -1 | awk '{print $3}')
    echo "✅ FFmpeg version: $ffmpeg_version"
else
    echo "⚠️  FFmpeg not found. Video conversion features will not work."
    echo "   Install with: sudo apt-get install ffmpeg (Ubuntu/Debian)"
    echo "   Install with: brew install ffmpeg (macOS)"
fi

# Create necessary directories
echo "📁 Creating development directories..."
mkdir -p tmp logs coverage benchmarks

# Set up git hooks (optional)
if [[ -d ".git" ]]; then
    echo "🪝 Setting up git hooks..."
    mkdir -p .git/hooks
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."
./scripts/qa/validate-code-quality.sh
EOF
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook installed"
fi

# Verify setup
echo "🧪 Verifying setup..."
if go test ./... > /dev/null 2>&1; then
    echo "✅ All tests pass"
else
    echo "⚠️  Some tests are failing. Run 'go test ./...' for details."
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Available scripts:"
echo "  ./scripts/dev/test-coverage.sh    - Run test coverage analysis"
echo "  ./scripts/dev/run-benchmarks.sh   - Run performance benchmarks"
echo "  ./scripts/qa/validate-code-quality.sh - Run code quality checks"
echo ""
echo "Common commands:"
echo "  go run cmd/server/main.go          - Start the server"
echo "  go test ./...                      - Run all tests"
echo "  docker-compose up                  - Start with Docker"