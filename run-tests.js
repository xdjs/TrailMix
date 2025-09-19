#!/usr/bin/env node

/**
 * Simple test runner for unit tests
 * Runs basic validation tests without requiring full Jest setup
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running Bandcamp Downloader Unit Tests\n');

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Simple test framework
function describe(name, testFn) {
  console.log(`📁 ${name}`);
  testFn();
  console.log('');
}

function test(name, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`  ✅ ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    failedTests++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toMatch: (regex) => {
      if (!regex.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${regex}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    }
  };
}

// Project structure tests
describe('Project Structure Validation', () => {
  const projectRoot = __dirname;
  
  test('should have required directories', () => {
    const dirs = ['background', 'content', 'popup', 'lib', 'tests'];
    dirs.forEach(dir => {
      const dirPath = path.join(projectRoot, dir);
      expect(fs.existsSync(dirPath)).toBeTruthy();
    });
  });
  
  test('should have required files', () => {
    const files = [
      'manifest.json',
      'package.json',
      'README.md',
      'background/service-worker.js',
      'popup/popup.html'
    ];
    files.forEach(file => {
      const filePath = path.join(projectRoot, file);
      expect(fs.existsSync(filePath)).toBeTruthy();
    });
  });
  
  test('should have valid manifest.json', () => {
    const manifestPath = path.join(projectRoot, 'manifest.json');
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Bandcamp Downloader');
  });
  
  test('should have valid package.json', () => {
    const packagePath = path.join(projectRoot, 'package.json');
    const content = fs.readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);
    
    expect(pkg.name).toBe('bandcamp-downloader');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// Utility tests
describe('Utility Functions', () => {
  // Load utils module
  const utilsPath = path.join(__dirname, 'lib', 'utils.js');
  const utils = require(utilsPath);
  
  test('should export utility functions', () => {
    expect(utils.Logger).toBeTruthy();
    expect(utils.StringUtils).toBeTruthy();
    expect(utils.PathUtils).toBeTruthy();
  });
  
  test('should sanitize filenames correctly', () => {
    const result = utils.StringUtils.sanitizeFilename('file<with>bad:chars');
    expect(result).toBe('file_with_bad_chars');
  });
  
  test('should join paths correctly', () => {
    const result = utils.PathUtils.join('a', 'b', 'c');
    expect(result).toBe('a/b/c');
  });
  
  test('should validate URLs correctly', () => {
    expect(utils.ValidationUtils.isValidUrl('https://example.com')).toBeTruthy();
    expect(utils.ValidationUtils.isValidUrl('not-a-url')).toBe(false);
  });
});

// File content validation
describe('File Content Validation', () => {
  test('should have proper service worker structure', () => {
    const swPath = path.join(__dirname, 'background', 'service-worker.js');
    const content = fs.readFileSync(swPath, 'utf8');
    
    expect(content).toContain('chrome.runtime.onInstalled');
    expect(content).toContain('chrome.runtime.onMessage');
    expect(content).toContain('initializeExtension');
  });
  
  test('should have proper popup HTML structure', () => {
    const popupPath = path.join(__dirname, 'popup', 'popup.html');
    const content = fs.readFileSync(popupPath, 'utf8');
    
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('Bandcamp Downloader');
    expect(content).toContain('popup.css');
    expect(content).toContain('popup.js');
  });
  
  test('should have proper content script structure', () => {
    const csPath = path.join(__dirname, 'content', 'bandcamp-scraper.js');
    const content = fs.readFileSync(csPath, 'utf8');
    
    expect(content).toContain('chrome.runtime.onMessage');
    expect(content).toContain('isBandcampPage');
    expect(content).toContain('DOMUtils');
  });
});

// Run the tests
console.log(`📊 Test Results:`);
console.log(`   Total: ${totalTests}`);
console.log(`   Passed: ${passedTests} ✅`);
console.log(`   Failed: ${failedTests} ❌`);

if (failedTests > 0) {
  console.log(`\n❌ Some tests failed. Please review the errors above.`);
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! The project structure is valid.`);
  process.exit(0);
}

