/**
 * Jest test setup file
 * Configures global test environment and mocks
 */

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  downloads: {
    download: jest.fn(),
    onChanged: {
      addListener: jest.fn()
    }
  },
  cookies: {
    get: jest.fn(),
    getAll: jest.fn()
  }
};

// Shim service worker global 'self'
if (!global.self) {
  global.self = {
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };
}

// Mock console methods for cleaner test output (but preserve original)
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock window object for popup tests
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://bandcamp.com/test',
    hostname: 'bandcamp.com'
  },
  writable: true
});

// Mock importScripts for service worker tests
global.importScripts = jest.fn();

// Mock TrailMixUtils for consistent testing
global.TrailMixUtils = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  sanitizeString: jest.fn(str => str),
  formatFileSize: jest.fn(size => `${size} bytes`),
  isValidUrl: jest.fn(url => url && url.startsWith('http')),
  createSafeFilename: jest.fn(name => name.replace(/[^a-zA-Z0-9.-]/g, '_'))
};

// Mock TrailMixAuth for auth manager tests  
global.TrailMixAuth = {
  authManager: null // Will be set by auth-manager.js
};

// Mock document methods
try {
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
    configurable: true
  });
} catch (_) {}

// Fix TextEncoder/TextDecoder for jsdom
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Setup DOM testing utilities
const { JSDOM } = require('jsdom');

// Create a JSDOM instance for each test
beforeEach(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset Chrome API mocks
  if (global.chrome) {
    Object.values(global.chrome).forEach(api => {
      if (typeof api === 'object' && api !== null) {
        Object.values(api).forEach(method => {
          if (jest.isMockFunction(method)) {
            method.mockReset();
          }
        });
      }
    });
  }
});


// Provide Jasmine-style pending to silence tests that call it
if (typeof global.pending !== 'function') {
  global.pending = () => {};
}
