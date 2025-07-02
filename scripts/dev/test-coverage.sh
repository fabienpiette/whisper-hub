#!/bin/bash
set -e

# Test Coverage Analysis Script
# Runs tests and generates detailed coverage reports

echo "🧪 Running comprehensive test coverage analysis..."

# Clean previous coverage files
rm -f coverage*.out

# Run tests with coverage
echo "📊 Generating coverage profile..."
go test -coverprofile=coverage.out ./...

# Generate coverage report
echo "📋 Coverage by package:"
go tool cover -func=coverage.out

# Generate HTML coverage report
echo "🌐 Generating HTML coverage report..."
go tool cover -html=coverage.out -o coverage.html

# Calculate total coverage
total_coverage=$(go tool cover -func=coverage.out | tail -1 | awk '{print $3}' | sed 's/%//')
echo ""
echo "📈 Total Coverage: ${total_coverage}%"

# Check coverage threshold
threshold=40
if (( $(echo "$total_coverage >= $threshold" | bc -l) )); then
    echo "✅ Coverage meets minimum threshold of ${threshold}%"
    exit 0
else
    echo "❌ Coverage ${total_coverage}% below minimum threshold of ${threshold}%"
    exit 1
fi