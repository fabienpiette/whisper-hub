#!/bin/bash
set -e

# Test Docker Hub authentication
# Usage: ./scripts/ci/test-docker-auth.sh

echo "🔐 Testing Docker Hub authentication..."

# Check if DOCKER_HUB_TOKEN is set (for local testing)
if [[ -z "$DOCKER_HUB_TOKEN" ]]; then
    echo "⚠️  DOCKER_HUB_TOKEN not set in environment"
    echo "For local testing, set: export DOCKER_HUB_TOKEN=your_token"
    echo "For GitHub Actions, ensure secret is configured"
    exit 1
fi

# Test login
echo "Testing Docker Hub login..."
echo "$DOCKER_HUB_TOKEN" | docker login -u sighadd --password-stdin

if [[ $? -eq 0 ]]; then
    echo "✅ Docker Hub authentication successful"
    
    # Test repository access
    echo "Testing repository access..."
    docker pull sighadd/whisper-hub:latest >/dev/null 2>&1 || echo "ℹ️  Latest tag not found (normal for new repo)"
    
    # Test push permissions (dry run)
    echo "Testing push permissions..."
    docker tag alpine:latest sighadd/whisper-hub:test-auth
    if docker push sighadd/whisper-hub:test-auth; then
        echo "✅ Push permissions verified"
        
        # Cleanup test tag
        echo "Cleaning up test tag..."
        # Note: Tag cleanup requires manual action via Docker Hub web interface
        echo "ℹ️  Please manually remove 'test-auth' tag from Docker Hub"
    else
        echo "❌ Push failed - check repository permissions"
        exit 1
    fi
else
    echo "❌ Docker Hub authentication failed"
    echo "Check your Docker Hub token and permissions"
    exit 1
fi

# Logout
docker logout
echo "✅ Authentication test completed successfully"