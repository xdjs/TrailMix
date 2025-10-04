#!/usr/bin/env node

/**
 * Build script for Chrome Web Store submission
 * Creates a clean ZIP file excluding development files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'trail-mix-extension.zip';
const BUILD_DIR = 'build';

// Files and directories to EXCLUDE from the package
const EXCLUDE_PATTERNS = [
  'node_modules',
  'tests',
  'coverage',
  'tmp',
  '.git',
  '.github',
  '.vscode',
  '.idea',
  '.DS_Store',
  '*.log',
  'package.json',
  'package-lock.json',
  'jest.config.js',
  '.babelrc',
  'run-tests.js',
  'test-runner.js',
  'create-icons.js',
  'build-package.js',
  PACKAGE_NAME,
  BUILD_DIR,
  'plans',
  'docs',
  'AGENTS.md',
  'CLAUDE.md',
  '.gitignore',
  '.claude'
];

// Files and directories to INCLUDE (relative to project root)
const INCLUDE_ITEMS = [
  'manifest.json',
  'background',
  'content',
  'sidepanel',
  'lib',
  'assets'
];

console.log('🔨 Building Trail Mix Chrome Extension Package...\n');

// Create build directory if it doesn't exist
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR);
  console.log(`✓ Created ${BUILD_DIR}/ directory`);
}

// Remove old package if exists
const packagePath = path.join(BUILD_DIR, PACKAGE_NAME);
if (fs.existsSync(packagePath)) {
  fs.unlinkSync(packagePath);
  console.log(`✓ Removed old ${PACKAGE_NAME}`);
}

// Build the zip command with included files
console.log('\n📦 Creating package with files:');
INCLUDE_ITEMS.forEach(item => {
  if (fs.existsSync(item)) {
    console.log(`  ✓ ${item}`);
  } else {
    console.warn(`  ⚠ ${item} not found`);
  }
});

try {
  // Create zip file with only the items we want, excluding .DS_Store files
  const zipCommand = `zip -r ${packagePath} ${INCLUDE_ITEMS.join(' ')} -x ${EXCLUDE_PATTERNS.map(p => `"*/${p}/*" "${p}/*"`).join(' ')} "*.DS_Store" "*/.DS_Store"`;

  execSync(zipCommand, { stdio: 'pipe' });

  // Get file size
  const stats = fs.statSync(packagePath);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n✅ Package created successfully!');
  console.log(`📍 Location: ${packagePath}`);
  console.log(`📊 Size: ${fileSizeInMB} MB`);
  console.log('\n🎯 Next steps:');
  console.log('1. Go to https://chrome.google.com/webstore/devconsole');
  console.log('2. Click "New Item"');
  console.log(`3. Upload ${packagePath}`);
  console.log('4. Fill in store listing details');
  console.log('5. Submit for review\n');

} catch (error) {
  console.error('❌ Error creating package:', error.message);
  process.exit(1);
}
