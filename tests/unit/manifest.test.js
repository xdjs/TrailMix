/**
 * Unit tests for manifest.json validation
 * Tests Task 1.2: Create Manifest V3 Configuration
 */

const fs = require('fs');
const path = require('path');

describe('Manifest.json Validation', () => {
  let manifest;
  
  beforeAll(() => {
    // Load the actual manifest.json file
    const manifestPath = path.join(__dirname, '../../manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  });
  
  describe('Basic Structure', () => {
    test('should have valid JSON structure', () => {
      expect(manifest).toBeDefined();
      expect(typeof manifest).toBe('object');
    });
    
    test('should use Manifest V3', () => {
      expect(manifest.manifest_version).toBe(3);
    });
    
    test('should have required basic fields', () => {
      expect(manifest.name).toBe('Bandcamp Downloader');
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning
      expect(manifest.description).toBeTruthy();
      expect(typeof manifest.description).toBe('string');
    });
  });
  
  describe('Permissions Configuration', () => {
    test('should include all required permissions', () => {
      const requiredPermissions = [
        'downloads',
        'cookies', 
        'activeTab',
        'storage',
        'scripting'
      ];
      
      expect(manifest.permissions).toBeDefined();
      expect(Array.isArray(manifest.permissions)).toBe(true);
      
      requiredPermissions.forEach(permission => {
        expect(manifest.permissions).toContain(permission);
      });
    });
    
    test('should have correct host permissions', () => {
      expect(manifest.host_permissions).toBeDefined();
      expect(Array.isArray(manifest.host_permissions)).toBe(true);
      expect(manifest.host_permissions).toContain('*://*.bandcamp.com/*');
    });
  });
  
  describe('Service Worker Configuration', () => {
    test('should have background service worker configured', () => {
      expect(manifest.background).toBeDefined();
      expect(manifest.background.service_worker).toBe('background/service-worker.js');
    });
  });
  
  describe('Action Configuration', () => {
    test('should have popup action configured', () => {
      expect(manifest.action).toBeDefined();
      expect(manifest.action.default_popup).toBe('popup/popup.html');
      expect(manifest.action.default_title).toBe('Bandcamp Downloader');
    });
    
    test('should have all required icon sizes', () => {
      const requiredSizes = ['16', '32', '48', '128'];
      
      expect(manifest.action.default_icon).toBeDefined();
      expect(manifest.icons).toBeDefined();
      
      requiredSizes.forEach(size => {
        expect(manifest.action.default_icon[size]).toBe(`assets/icons/icon${size}.png`);
        expect(manifest.icons[size]).toBe(`assets/icons/icon${size}.png`);
      });
    });
  });
  
  describe('Content Scripts Configuration', () => {
    test('should have content scripts configured for Bandcamp', () => {
      expect(manifest.content_scripts).toBeDefined();
      expect(Array.isArray(manifest.content_scripts)).toBe(true);
      expect(manifest.content_scripts.length).toBeGreaterThan(0);
      
      const bandcampScript = manifest.content_scripts[0];
      expect(bandcampScript.matches).toContain('*://*.bandcamp.com/*');
      expect(bandcampScript.js).toContain('content/bandcamp-scraper.js');
      expect(bandcampScript.run_at).toBe('document_idle');
    });
  });
  
  describe('Content Security Policy', () => {
    test('should have secure CSP configuration', () => {
      expect(manifest.content_security_policy).toBeDefined();
      expect(manifest.content_security_policy.extension_pages).toBeDefined();
      
      const csp = manifest.content_security_policy.extension_pages;
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'self'");
    });
  });
  
  describe('Security Validation', () => {
    test('should not contain dangerous permissions', () => {
      const dangerousPermissions = [
        'tabs',
        'history',
        'bookmarks',
        'geolocation',
        'notifications'
      ];
      
      dangerousPermissions.forEach(permission => {
        expect(manifest.permissions || []).not.toContain(permission);
      });
    });
    
    test('should have specific host permissions only', () => {
      // Should only have Bandcamp permissions, not broad permissions
      const broadPermissions = [
        '*://*/*',
        'http://*/*',
        'https://*/*'
      ];
      
      broadPermissions.forEach(permission => {
        expect(manifest.host_permissions || []).not.toContain(permission);
      });
    });
  });
  
  describe('File References', () => {
    test('should reference existing files', () => {
      const filesToCheck = [
        manifest.background.service_worker,
        manifest.action.default_popup,
        ...manifest.content_scripts[0].js
      ];
      
      filesToCheck.forEach(filePath => {
        const fullPath = path.join(__dirname, '../../', filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
    
    test('should have valid icon references', () => {
      // Note: Icons don't exist yet, but paths should be valid
      const iconSizes = ['16', '32', '48', '128'];
      
      iconSizes.forEach(size => {
        const iconPath = manifest.icons[size];
        expect(iconPath).toBe(`assets/icons/icon${size}.png`);
        expect(iconPath).toMatch(/^assets\/icons\/icon\d+\.png$/);
      });
    });
  });
});

