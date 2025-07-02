#!/bin/bash
PR_TITLE="feat(converter): adaptive bitrate video conversion for OpenAI size compliance"
echo "PR Title: $PR_TITLE"

# Check if title follows conventional commit format
regex='^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: .+'
if [[ $PR_TITLE =~ $regex ]]; then
  echo "✅ PR title follows conventional commit format"
else
  echo "❌ PR title should follow conventional commit format: type(scope): description"
  echo "Examples: feat: add new feature, fix: resolve bug, docs: update readme"
  exit 1
fi
