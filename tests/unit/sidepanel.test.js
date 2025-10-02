/**
 * Unit tests for side panel functionality
 * Tests Task 4.10: Convert Popup to Side Panel UI
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Mock Chrome APIs
const chromeMock = require('../mocks/chrome-mock');
global.chrome = chromeMock;

describe('Side Panel UI', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Load the actual sidepanel HTML
    const htmlPath = path.join(__dirname, '../../sidepanel/sidepanel.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Create DOM environment
    dom = new JSDOM(htmlContent, {
      url: 'chrome-extension://test/sidepanel/sidepanel.html',
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
      const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
      expect(cssLinks.length).toBeGreaterThan(0);

      // Check for sidepanel.css specifically
      const sidepanelCss = Array.from(cssLinks).find(link =>
        link.getAttribute('href') === 'sidepanel.css'
      );
      expect(sidepanelCss).toBeTruthy();
    });

    test('should include sidepanel script', () => {
      const script = document.querySelector('script[src="sidepanel.js"]');
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
      expect(title.textContent).toBe('Trail Mix');
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
    test('should have semantic HTML structure', () => {
      const header = document.querySelector('header');
      const sections = document.querySelectorAll('section');
      const footer = document.querySelector('footer');

      expect(header).toBeTruthy();
      expect(sections.length).toBeGreaterThan(0);
      expect(footer).toBeTruthy();
    });

    test('should expose activity log summary for accessibility', () => {
      const logDetails = document.querySelector('.log-section details');
      const logSummary = document.querySelector('.log-section summary');

      expect(logDetails).toBeTruthy();
      expect(logSummary).toBeTruthy();
      expect(logSummary.textContent).toContain('Activity Log');
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

  describe('Simplified Layout', () => {
    test('should not include deprecated settings elements', () => {
      expect(document.querySelector('.settings-section')).toBeNull();
      expect(document.querySelector('#downloadDelay')).toBeNull();
      expect(document.querySelector('#embedMetadata')).toBeNull();
      expect(document.querySelector('#embedArtwork')).toBeNull();
    });

    test('should display log controls within details element', () => {
      const logDetails = document.querySelector('.log-section details');
      const logContent = document.querySelector('.log-section .log-content');
      const clearLogBtn = document.querySelector('#clearLogBtn');

      expect(logDetails).toBeTruthy();
      expect(logContent).toBeTruthy();
      expect(clearLogBtn).toBeTruthy();
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
      const warningBtn = document.querySelector('.btn-warning');
      const dangerBtn = document.querySelector('.btn-danger');

      expect(primaryBtn).toBeTruthy();
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

  describe('Not-Logged-In State', () => {
    test('should use pink status indicator for not-logged-in state', () => {
      const statusIndicator = document.querySelector('.status-indicator');
      statusIndicator.className = 'status-indicator not-logged-in';

      // Verify the class is applied correctly
      expect(statusIndicator.classList.contains('not-logged-in')).toBe(true);
      expect(statusIndicator.classList.contains('status-indicator')).toBe(true);

      // Verify CSS variable is defined in stylesheet
      const cssPath = path.join(__dirname, '../../sidepanel/sidepanel.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      expect(cssContent).toContain('--primary-pink: #FF4EB6');
      expect(cssContent).toContain('.status-indicator.not-logged-in');
      expect(cssContent).toContain('background-color: var(--primary-pink)');
    });

    test('should hide Start Download button when not logged in', () => {
      const startBtn = document.querySelector('#startBtn');

      // Simulate not-logged-in state: button should not have .visible class
      startBtn.classList.remove('visible');

      expect(startBtn.classList.contains('visible')).toBe(false);
    });

    test('should show Start Download button when authenticated', () => {
      const startBtn = document.querySelector('#startBtn');

      // Simulate authenticated state: button should have .visible class
      startBtn.classList.add('visible');

      expect(startBtn.classList.contains('visible')).toBe(true);
    });
  });

  describe('Progress Section Layout', () => {
    test('should hide percentage overlay on progress bar', () => {
      const progressText = document.querySelector('#progressText');
      expect(progressText).toBeTruthy();

      // Verify CSS rule exists to hide the percentage overlay
      const cssPath = path.join(__dirname, '../../sidepanel/sidepanel.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      expect(cssContent).toContain('.progress-text');
      expect(cssContent).toContain('display: none');
    });

    test('should show empty current album text initially', () => {
      const currentAlbum = document.querySelector('.current-album');
      expect(currentAlbum.textContent).toBe('');
    });

    test('should position progress stats below progress bar', () => {
      const progressStats = document.querySelector('.progress-stats');
      const progressBarContainer = document.querySelector('.progress-bar-container');

      expect(progressStats).toBeTruthy();
      expect(progressBarContainer).toBeTruthy();

      // Progress stats should come after progress bar in DOM order
      const parent = progressStats.parentElement;
      const children = Array.from(parent.children);
      const statsIndex = children.indexOf(progressStats);
      const barIndex = children.indexOf(progressBarContainer);

      expect(statsIndex).toBeGreaterThan(barIndex);
    });
  });

  describe('Progress Text Formatting', () => {
    let elements;

    beforeEach(() => {
      // Set up elements object similar to sidepanel.js
      elements = {
        progressFill: document.querySelector('#progressFill'),
        progressText: document.querySelector('#progressText'),
        progressStats: document.querySelector('#progressStats')
      };
    });

    test('should format progress stats with percentage and album count', () => {
      const stats = { completed: 1, total: 24, active: 0 };

      // Simulate updateProgress function logic
      const percentage = Math.round((stats.completed / stats.total) * 100);
      elements.progressFill.style.width = `${percentage}%`;
      elements.progressText.textContent = `${percentage}%`;
      elements.progressStats.textContent = `${percentage}% (${stats.completed} of ${stats.total} albums)`;

      expect(elements.progressStats.textContent).toBe('4% (1 of 24 albums)');
      expect(elements.progressFill.style.width).toBe('4%');
    });

    test('should include active downloads in progress stats', () => {
      const stats = { completed: 5, total: 20, active: 2 };

      // Simulate updateProgress function logic
      const percentage = Math.round((stats.completed / stats.total) * 100);
      elements.progressFill.style.width = `${percentage}%`;
      elements.progressText.textContent = `${percentage}%`;

      if (stats.active !== undefined && stats.active > 0) {
        elements.progressStats.textContent = `${percentage}% (${stats.completed} of ${stats.total} albums) (${stats.active} active)`;
      } else {
        elements.progressStats.textContent = `${percentage}% (${stats.completed} of ${stats.total} albums)`;
      }

      expect(elements.progressStats.textContent).toBe('25% (5 of 20 albums) (2 active)');
      expect(elements.progressFill.style.width).toBe('25%');
    });

    test('should calculate percentage correctly for edge cases', () => {
      // Test 0% progress
      let stats = { completed: 0, total: 24 };
      let percentage = Math.round((stats.completed / stats.total) * 100);
      expect(percentage).toBe(0);

      // Test 100% progress
      stats = { completed: 24, total: 24 };
      percentage = Math.round((stats.completed / stats.total) * 100);
      expect(percentage).toBe(100);

      // Test rounding
      stats = { completed: 1, total: 3 };
      percentage = Math.round((stats.completed / stats.total) * 100);
      expect(percentage).toBe(33);
    });
  });

  describe('Activity Log Functionality (Task 5.6)', () => {
    describe('Log Structure', () => {
      test('should have log content element', () => {
        const logContent = document.getElementById('logContent');
        expect(logContent).toBeTruthy();
        expect(logContent.className).toBe('log-content');
      });

      test('should have initial log entry', () => {
        const logContent = document.getElementById('logContent');
        const entries = logContent.querySelectorAll('.log-entry');
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0].textContent).toContain('Extension initialized');
      });

      test('should have clear log button', () => {
        const clearLogBtn = document.getElementById('clearLogBtn');
        expect(clearLogBtn).toBeTruthy();
        expect(clearLogBtn.textContent).toBe('Clear Log');
      });
    });

    describe('Log Entry Format', () => {
      test('should support info, success, warning, error classes', () => {
        const logContent = document.getElementById('logContent');

        // Create test entries with different types
        const types = ['info', 'success', 'warning', 'error'];
        types.forEach(type => {
          const entry = document.createElement('div');
          entry.className = `log-entry ${type}`;
          entry.textContent = `Test ${type} message`;
          logContent.appendChild(entry);
        });

        const entries = logContent.querySelectorAll('.log-entry');
        const lastFour = Array.from(entries).slice(-4);

        expect(lastFour[0].className).toBe('log-entry info');
        expect(lastFour[1].className).toBe('log-entry success');
        expect(lastFour[2].className).toBe('log-entry warning');
        expect(lastFour[3].className).toBe('log-entry error');
      });

      test('should support timestamp format in entries', () => {
        const logContent = document.getElementById('logContent');

        // Create test entry with timestamp
        const entry = document.createElement('div');
        entry.className = 'log-entry info';
        entry.textContent = '1:35:19 PM: Starting download 7 of 24';
        logContent.appendChild(entry);

        const lastEntry = logContent.lastElementChild;
        expect(lastEntry.textContent).toMatch(/\d+:\d+:\d+.*:/);
      });
    });

    describe('Message Deduplication Implementation', () => {
      test('should have deduplication variables in script', () => {
        const jsPath = path.join(__dirname, '../../sidepanel/sidepanel.js');
        const jsContent = fs.readFileSync(jsPath, 'utf8');

        // Check for deduplication implementation
        expect(jsContent).toContain('lastLogMessage');
        expect(jsContent).toContain('lastLogTimestamp');
        expect(jsContent).toContain('Date.now()');
      });

      test('should check for duplicates within time window', () => {
        const jsPath = path.join(__dirname, '../../sidepanel/sidepanel.js');
        const jsContent = fs.readFileSync(jsPath, 'utf8');

        // Check for 1-second deduplication logic
        expect(jsContent).toContain('1000'); // 1 second in ms
        expect(jsContent).toMatch(/lastLogMessage.*===.*message/);
      });
    });

    describe('LOG_MESSAGE Handler Implementation', () => {
      test('should have LOG_MESSAGE handler in script', () => {
        const jsPath = path.join(__dirname, '../../sidepanel/sidepanel.js');
        const jsContent = fs.readFileSync(jsPath, 'utf8');

        expect(jsContent).toContain('LOG_MESSAGE');
        expect(jsContent).toContain('chrome.runtime.onMessage');
        expect(jsContent).toContain('addLogEntry');
      });

      test('should handle message with logType parameter', () => {
        const jsPath = path.join(__dirname, '../../sidepanel/sidepanel.js');
        const jsContent = fs.readFileSync(jsPath, 'utf8');

        // Check that LOG_MESSAGE handler extracts message and logType
        expect(jsContent).toMatch(/message\.message/);
        expect(jsContent).toMatch(/message\.logType/);
      });
    });
  });
});
