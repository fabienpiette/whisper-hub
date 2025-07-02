#!/bin/bash
set -e

# Code Quality Validation Script
# Comprehensive code quality checks

echo "🔍 Running code quality validation..."

# Check if gocyclo is installed
if ! command -v gocyclo &> /dev/null; then
    echo "📦 Installing gocyclo..."
    go install github.com/fzipp/gocyclo/cmd/gocyclo@latest
fi

# Check cyclomatic complexity
echo "🔄 Checking cyclomatic complexity..."
if gocyclo -over 10 .; then
    echo "❌ High complexity functions found (>10)"
    exit 1
else
    echo "✅ Code complexity is acceptable"
fi

# Check for potential issues
echo "🔍 Checking for potential code issues..."

# Look for TODO/FIXME comments
echo "📝 Checking for TODO/FIXME comments..."
todo_count=$(grep -r "TODO\|FIXME" --include="*.go" . | wc -l || echo "0")
if [[ $todo_count -gt 0 ]]; then
    echo "⚠️  Found $todo_count TODO/FIXME comments"
    grep -r "TODO\|FIXME" --include="*.go" . | head -5
else
    echo "✅ No TODO/FIXME comments found"
fi

# Check for large functions
echo "📏 Checking for large functions..."
large_functions=$(grep -n "func " --include="*.go" -A 50 -r . | grep -E "^.*func.*\{$" -A 50 | grep -c "^--$" || echo "0")
echo "📊 Function count analysis complete"

# Check for commented code blocks
echo "🧹 Checking for commented code..."
commented_files=$(find . -name "*.go" -exec grep -l "//.*//.*//.*//.*" {} \; 2>/dev/null || true)
if [[ -n "$commented_files" ]]; then
    echo "⚠️  Files with potential commented code blocks:"
    echo "$commented_files"
else
    echo "✅ No large commented code blocks found"
fi

# Check for proper error handling
echo "🚨 Checking error handling patterns..."
error_checks=$(grep -r "if err != nil" --include="*.go" . | wc -l || echo "0")
error_ignores=$(grep -r "_ = " --include="*.go" . | wc -l || echo "0")
echo "📊 Error handling: $error_checks checks, $error_ignores ignores"

# Summary
echo ""
echo "✅ Code quality validation complete"
echo "📊 Summary:"
echo "   - Cyclomatic complexity: ✅ Acceptable"
echo "   - TODO/FIXME comments: $todo_count found"
echo "   - Error handling: $error_checks checks, $error_ignores ignores"