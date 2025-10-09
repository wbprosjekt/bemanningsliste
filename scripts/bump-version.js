#!/usr/bin/env node

/**
 * Automatic version bump script
 * Bumps patch version for every commit to Vercel
 * Usage: node scripts/bump-version.js [patch|minor|major]
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

function bumpVersion(type = 'patch') {
  try {
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    
    // Parse current version
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    // Bump version based on type
    let newVersion;
    switch (type) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }
    
    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ Version bumped: ${currentVersion} → ${newVersion}`);
    return newVersion;
  } catch (error) {
    console.error('❌ Error bumping version:', error.message);
    process.exit(1);
  }
}

// Get bump type from command line args
const bumpType = process.argv[2] || 'patch';
bumpVersion(bumpType);
