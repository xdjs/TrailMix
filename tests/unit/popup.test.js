/**
 * Unit tests for popup functionality
 * Tests Task 1.4: Create Popup UI Shell
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Mock Chrome APIs
const chromeMock = require('../mocks/chrome-mock');
global.chrome = chromeMock;

describe('Popup UI', () => {
  let dom;
  let document;
  let window;
  
  beforeEach(() => {
    // Load the actual popup HTML
    const htmlPath = path.join(__dirname, '../../popup/popup.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Create DOM environment
    dom = new JSDOM(htmlContent, {
      url: 'chrome-extension://test/popup/popup.html',
      runScripts: 'outside-only',
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window;
    
    // Set up global environment
    global.document = document;
    global.window = window;
    
    // Mock window.close
    window.close = jest.fn();
  });
  
  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });
  
  describe('HTML Structure', () => {
    test('should have valid HTML document structure', () => {
      expect(document.doctype).toBeTruthy();
      expect(document.documentElement.tagName).toBe('HTML');
      expect(document.head).toBeTruthy();
      expect(document.body).toBeTruthy();
    });
    
    test('should have correct meta tags', () => {
      const charset = document.querySelector('meta[charset]');
      const viewport = document.querySelector('meta[name="viewport"]');
      
      expect(charset).toBeTruthy();
      expect(charset.getAttribute('charset')).toBe('UTF-8');
      expect(viewport).toBeTruthy();
    });
    
    test('should include required stylesheets', () => {
      const cssLink = document.querySelector('link[rel="stylesheet"]');
      expect(cssLink).toBeTruthy();
      expect(cssLink.getAttribute('href')).toBe('popup.css');
    });
    
    test('should include popup script', () => {
      const script = document.querySelector('script[src="popup.js"]');
      expect(script).toBeTruthy();
    });
  });
  
  describe('UI Components', () => {
    test('should have header section with title and version', () => {
      const header = document.querySelector('.header');
      const title = document.querySelector('.title');
      const version = document.querySelector('.version');
      
      expect(header).toBeTruthy();
      expect(title).toBeTruthy();
      expect(title.textContent).toBe('Bandcamp Downloader');
      expect(version).toBeTruthy();
      expect(version.textContent).toMatch(/v\d+\.\d+\.\d+/);
    });
    
    test('should have authentication status section', () => {
      const authSection = document.querySelector('.auth-section');
      const authStatus = document.querySelector('.auth-status');
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.querySelector('.status-text');
      const loginBtn = document.querySelector('#loginBtn');
      
      expect(authSection).toBeTruthy();
      expect(authStatus).toBeTruthy();
      expect(statusIndicator).toBeTruthy();
      expect(statusText).toBeTruthy();
      expect(loginBtn).toBeTruthy();
    });
    
    test('should have progress dashboard section', () => {
      const progressSection = document.querySelector('#progressSection');
      const progressStats = document.querySelector('#progressStats');
      const progressBar = document.querySelector('#progressBar');
      const progressFill = document.querySelector('#progressFill');
      const progressText = document.querySelector('#progressText');
      const currentItem = document.querySelector('#currentItem');
      
      expect(progressSection).toBeTruthy();
      expect(progressStats).toBeTruthy();
      expect(progressBar).toBeTruthy();
      expect(progressFill).toBeTruthy();
      expect(progressText).toBeTruthy();
      expect(currentItem).toBeTruthy();
    });
    
    test('should have control buttons', () => {
      const controlsSection = document.querySelector('.controls-section');
      const startBtn = document.querySelector('#startBtn');
      const pauseBtn = document.querySelector('#pauseBtn');
      const stopBtn = document.querySelector('#stopBtn');
      
      expect(controlsSection).toBeTruthy();
      expect(startBtn).toBeTruthy();
      expect(pauseBtn).toBeTruthy();
      expect(stopBtn).toBeTruthy();
      
      // Check initial states
      expect(startBtn.disabled).toBe(true);
      expect(pauseBtn.style.display).toBe('none');
      expect(stopBtn.style.display).toBe('none');
    });
    
    test('should have settings section', () => {
      const settingsSection = document.querySelector('.settings-section');
      const downloadLocation = document.querySelector('#downloadLocation');
      const downloadDelay = document.querySelector('#downloadDelay');
      const embedMetadata = document.querySelector('#embedMetadata');
      const embedArtwork = document.querySelector('#embedArtwork');
      
      expect(settingsSection).toBeTruthy();
      expect(downloadLocation).toBeTruthy();
      expect(downloadDelay).toBeTruthy();
      expect(embedMetadata).toBeTruthy();
      expect(embedArtwork).toBeTruthy();
      
      // Check default values
      expect(downloadDelay.value).toBe('2');
      expect(embedMetadata.checked).toBe(true);
      expect(embedArtwork.checked).toBe(true);
    });
    
    test('should have activity log section', () => {
      const logSection = document.querySelector('.log-section');
      const logContent = document.querySelector('#logContent');
      const clearLogBtn = document.querySelector('#clearLogBtn');
      
      expect(logSection).toBeTruthy();
      expect(logContent).toBeTruthy();
      expect(clearLogBtn).toBeTruthy();
    });
    
    test('should have footer with legal notice', () => {
      const footer = document.querySelector('.footer');
      const footerText = document.querySelector('.footer-text');
      
      expect(footer).toBeTruthy();
      expect(footerText).toBeTruthy();
      expect(footerText.textContent).toContain('Personal archival use only');
    });
  });
  
  describe('Accessibility', () => {
    test('should have proper label associations', () => {
      const downloadLocationLabel = document.querySelector('label[for="downloadLocation"]');
      const downloadDelayLabel = document.querySelector('label[for="downloadDelay"]');
      
      expect(downloadLocationLabel).toBeTruthy();
      expect(downloadDelayLabel).toBeTruthy();
    });
    
    test('should have semantic HTML structure', () => {
      const header = document.querySelector('header');
      const sections = document.querySelectorAll('section');
      const footer = document.querySelector('footer');
      
      expect(header).toBeTruthy();
      expect(sections.length).toBeGreaterThan(0);
      expect(footer).toBeTruthy();
    });
    
    test('should have proper button types', () => {
      const buttons = document.querySelectorAll('button');
      
      buttons.forEach(button => {
        // All buttons should have type="button" or be submit buttons
        const type = button.getAttribute('type');
        expect(type === null || type === 'button' || type === 'submit').toBe(true);
      });
    });
  });
  
  describe('Form Elements', () => {
    test('should have proper input types and attributes', () => {
      const downloadLocation = document.querySelector('#downloadLocation');
      const downloadDelay = document.querySelector('#downloadDelay');
      
      expect(downloadLocation.type).toBe('text');
      expect(downloadLocation.readOnly).toBe(true);
      
      expect(downloadDelay.type).toBe('number');
      expect(downloadDelay.min).toBe('1');
      expect(downloadDelay.max).toBe('60');
    });
    
    test('should have checkboxes for boolean settings', () => {
      const embedMetadata = document.querySelector('#embedMetadata');
      const embedArtwork = document.querySelector('#embedArtwork');
      
      expect(embedMetadata.type).toBe('checkbox');
      expect(embedArtwork.type).toBe('checkbox');
    });
  });
  
  describe('CSS Classes', () => {
    test('should have proper CSS classes for styling', () => {
      const container = document.querySelector('.container');
      const buttons = document.querySelectorAll('.btn');
      const progressBar = document.querySelector('.progress-bar');
      
      expect(container).toBeTruthy();
      expect(buttons.length).toBeGreaterThan(0);
      expect(progressBar).toBeTruthy();
      
      // Check button variants
      const primaryBtn = document.querySelector('.btn-primary');
      const successBtn = document.querySelector('.btn-success');
      const warningBtn = document.querySelector('.btn-warning');
      const dangerBtn = document.querySelector('.btn-danger');
      
      expect(primaryBtn).toBeTruthy();
      expect(successBtn).toBeTruthy();
      expect(warningBtn).toBeTruthy();
      expect(dangerBtn).toBeTruthy();
    });
  });
  
  describe('Initial State', () => {
    test('should have correct initial visibility states', () => {
      const progressSection = document.querySelector('#progressSection');
      const loginBtn = document.querySelector('#loginBtn');
      const pauseBtn = document.querySelector('#pauseBtn');
      const stopBtn = document.querySelector('#stopBtn');
      
      expect(progressSection.style.display).toBe('none');
      expect(loginBtn.style.display).toBe('none');
      expect(pauseBtn.style.display).toBe('none');
      expect(stopBtn.style.display).toBe('none');
    });
    
    test('should have initial log entry', () => {
      const logEntries = document.querySelectorAll('.log-entry');
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].textContent).toBe('Extension initialized');
    });
  });
});

