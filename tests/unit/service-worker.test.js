/**
 * Unit tests for background service worker
 * Tests Task 1.3: Implement Service Worker Foundation
 */

// Mock Chrome APIs
const chromeMock = require('../mocks/chrome-mock');
global.chrome = chromeMock;

describe('Service Worker', () => {
  let serviceWorker;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset Chrome API mocks
    chrome.runtime.onInstalled.addListener.mockClear();
    chrome.runtime.onStartup.addListener.mockClear();
    chrome.runtime.onMessage.addListener.mockClear();
    chrome.storage.local.set.mockClear();
    chrome.storage.local.get.mockClear();

    // Load the service worker module fresh
    delete require.cache[require.resolve('../../background/service-worker.js')];
    serviceWorker = require('../../background/service-worker.js');
  });
  
  describe('Extension Lifecycle', () => {
    test('should register onInstalled listener', () => {
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    });

    test('should register onStartup listener', () => {
      // Check that chrome.runtime.onStartup is defined
      expect(chrome.runtime.onStartup).toBeDefined();
      expect(chrome.runtime.onStartup.addListener).toBeDefined();
      // Check that it was called when the module loaded
      expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
    });

    test('should handle first time installation', async () => {
      const calls = chrome.runtime.onInstalled.addListener.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const onInstalledCallback = calls[0][0];

      // Mock storage.local.set
      chrome.storage.local.set.mockResolvedValue();

      // Simulate first install
      await onInstalledCallback({ reason: 'install' });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        downloadLocation: '',
        retryAttempts: 3,
        downloadDelay: 2000,
        metadataEmbedding: true,
        artworkEmbedding: true
      });
    });

    test('should handle extension updates', async () => {
      const calls = chrome.runtime.onInstalled.addListener.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const onInstalledCallback = calls[0][0];

      // Simulate update
      await onInstalledCallback({
        reason: 'update',
        previousVersion: '0.9.0'
      });

      // Should not reinitialize settings on update
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('should handle startup event', () => {
      const calls = chrome.runtime.onStartup.addListener.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const onStartupCallback = calls[0][0];

      expect(() => onStartupCallback()).not.toThrow();
    });
  });
  
  describe('Message Handling', () => {
    let messageHandler;

    beforeEach(() => {
      const calls = chrome.runtime.onMessage.addListener.mock.calls;
      if (calls.length > 0) {
        messageHandler = calls[0][0];
      }
    });

    test('should register message listener', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
    
    test('should handle GET_EXTENSION_STATUS message', async () => {
      if (!messageHandler) {
        console.warn('Message handler not registered - skipping test');
        return;
      }
      const mockSendResponse = jest.fn();
      const mockSettings = { downloadDelay: 2000 };

      chrome.storage.local.get.mockResolvedValue(mockSettings);

      const result = messageHandler(
        { type: 'GET_EXTENSION_STATUS' },
        { tab: { id: 1 } },
        mockSendResponse
      );

      expect(result).toBe(true); // Should keep channel open

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.storage.local.get).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({
        status: 'ready',
        settings: mockSettings
      });
    });

    test('should handle START_DOWNLOAD message', () => {
      if (!messageHandler) {
        console.warn('Message handler not registered - skipping test');
        return;
      }
      const mockSendResponse = jest.fn();

      const result = messageHandler(
        { type: 'START_DOWNLOAD', data: {} },
        { tab: { id: 1 } },
        mockSendResponse
      );

      expect(result).toBe(true);
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'started' });
    });

    test('should handle PAUSE_DOWNLOAD message', () => {
      if (!messageHandler) {
        console.warn('Message handler not registered - skipping test');
        return;
      }
      const mockSendResponse = jest.fn();

      const result = messageHandler(
        { type: 'PAUSE_DOWNLOAD' },
        { tab: { id: 1 } },
        mockSendResponse
      );

      expect(result).toBe(true);
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'paused' });
    });

    test('should handle STOP_DOWNLOAD message', () => {
      if (!messageHandler) {
        console.warn('Message handler not registered - skipping test');
        return;
      }
      const mockSendResponse = jest.fn();

      const result = messageHandler(
        { type: 'STOP_DOWNLOAD' },
        { tab: { id: 1 } },
        mockSendResponse
      );

      expect(result).toBe(true);
      expect(mockSendResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });

    test('should handle unknown message types', () => {
      if (!messageHandler) {
        console.warn('Message handler not registered - skipping test');
        return;
      }
      const mockSendResponse = jest.fn();

      messageHandler(
        { type: 'UNKNOWN_MESSAGE' },
        { tab: { id: 1 } },
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        error: 'Unknown message type'
      });
    });

    test('should handle storage errors gracefully', async () => {
      if (!messageHandler) {
        console.warn('Message handler not registered - skipping test');
        return;
      }
      const mockSendResponse = jest.fn();
      const storageError = new Error('Storage access denied');

      chrome.storage.local.get.mockRejectedValue(storageError);

      messageHandler(
        { type: 'GET_EXTENSION_STATUS' },
        { tab: { id: 1 } },
        mockSendResponse
      );

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSendResponse).toHaveBeenCalledWith({
        error: storageError.message
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle global errors', () => {
      const errorEvent = new ErrorEvent('error', {
        error: new Error('Test error'),
        message: 'Test error message'
      });
      
      expect(() => {
        self.dispatchEvent(errorEvent);
      }).not.toThrow();
    });
    
    test('should handle unhandled promise rejections', () => {
      // Mock PromiseRejectionEvent for Node.js environment
      const rejectionEvent = {
        type: 'unhandledrejection',
        reason: new Error('Test rejection'),
        promise: Promise.resolve(), // Use resolved promise to avoid unhandled rejection
        preventDefault: jest.fn()
      };
      
      expect(() => {
        self.dispatchEvent(rejectionEvent);
      }).not.toThrow();
    });
  });
  
  describe('Initialization', () => {
    test('should set default settings correctly', async () => {
      chrome.storage.local.set.mockResolvedValue();

      const calls = chrome.runtime.onInstalled.addListener.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const onInstalledCallback = calls[0][0];
      await onInstalledCallback({ reason: 'install' });

      const expectedSettings = {
        downloadLocation: '',
        retryAttempts: 3,
        downloadDelay: 2000,
        metadataEmbedding: true,
        artworkEmbedding: true
      };

      expect(chrome.storage.local.set).toHaveBeenCalledWith(expectedSettings);
    });

    test('should handle initialization errors', async () => {
      const storageError = new Error('Storage initialization failed');
      chrome.storage.local.set.mockRejectedValue(storageError);

      const calls = chrome.runtime.onInstalled.addListener.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const onInstalledCallback = calls[0][0];

      // Should not throw error
      await expect(onInstalledCallback({ reason: 'install' })).resolves.toBeUndefined();
    });
  });
});

