#!/bin/bash

# Build and Push Script
# This script runs npm run build before pushing to GitHub

set -e  # Exit on error

echo "🔨 Running build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📦 Pushing to GitHub..."
    git push origin feature/befaring-module
    echo "✅ Push successful!"
else
    echo "❌ Build failed! Not pushing to GitHub."
    exit 1
fi

