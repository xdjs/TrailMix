/**
 * Chrome Extension API Mocks
 * Provides mock implementations of Chrome extension APIs for testing
 */

const chromeMock = {
  runtime: {
    onInstalled: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn((message, callback) => {
      if (callback) {
        setTimeout(() => callback({ success: true }), 0);
      }
    }),
    lastError: null,
    id: 'test-extension-id'
  },
  
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const mockData = {
          downloadLocation: '',
          retryAttempts: 3,
          downloadDelay: 2000,
          metadataEmbedding: true,
          artworkEmbedding: true
        };
        
        if (callback) {
          setTimeout(() => callback(mockData), 0);
        }
        return Promise.resolve(mockData);
      }),
      set: jest.fn((data, callback) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
      remove: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  
  tabs: {
    query: jest.fn((queryInfo, callback) => {
      const mockTab = {
        id: 1,
        url: 'https://bandcamp.com',
        title: 'Bandcamp',
        active: true
      };
      
      if (callback) {
        setTimeout(() => callback([mockTab]), 0);
      }
      return Promise.resolve([mockTab]);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      const mockResponse = { success: true, authenticated: true };
      if (callback) {
        setTimeout(() => callback(mockResponse), 0);
      }
    }),
    create: jest.fn()
  },
  
  downloads: {
    download: jest.fn((options, callback) => {
      const downloadId = Math.floor(Math.random() * 1000);
      if (callback) {
        setTimeout(() => callback(downloadId), 0);
      }
      return Promise.resolve(downloadId);
    }),
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    search: jest.fn(),
    cancel: jest.fn()
  },
  
  cookies: {
    get: jest.fn((details, callback) => {
      const mockCookie = {
        name: 'session',
        value: 'mock-session-value',
        domain: '.bandcamp.com'
      };
      if (callback) {
        setTimeout(() => callback(mockCookie), 0);
      }
    }),
    getAll: jest.fn((details, callback) => {
      const mockCookies = [
        { name: 'session', value: 'mock-session', domain: '.bandcamp.com' }
      ];
      if (callback) {
        setTimeout(() => callback(mockCookies), 0);
      }
    })
  }
};

module.exports = chromeMock;

