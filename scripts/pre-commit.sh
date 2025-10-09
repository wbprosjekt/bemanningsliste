#!/bin/bash

# Pre-commit hook to automatically bump version
# This ensures every commit has a unique version number

echo "🔄 Auto-bumping version for commit..."

# Bump patch version
node scripts/bump-version.js patch

# Add the updated package.json to the commit
git add package.json

echo "✅ Version bumped and added to commit"
