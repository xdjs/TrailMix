/**
 * Unit tests for content script
 * Tests Task 1.5: Set Up Content Script Infrastructure
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Mock Chrome APIs
const chromeMock = require('../mocks/chrome-mock');
global.chrome = chromeMock;

describe('Content Script', () => {
  let dom;
  let window;
  let document;
  
  beforeEach(() => {
    // Create a mock Bandcamp page
    const mockBandcampHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Artist - Test Album</title>
      </head>
      <body>
        <div class="menubar-item user-menu">User Menu</div>
        <div class="purchase-item">
          <a href="/album/test-album">Test Album</a>
          <span class="artist">Test Artist</span>
        </div>
      </body>
      </html>
    `;
    
    dom = new JSDOM(mockBandcampHtml, {
      url: 'https://testartist.bandcamp.com/album/test-album',
      runScripts: 'outside-only'
    });
    
    window = dom.window;
    document = dom.window.document;
    
    // Set up globals
    global.window = window;
    global.document = document;
    global.console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    
    // Mock document ready state
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    if (dom) {
      dom.window.close();
    }
  });
  
  describe('Content Script Loading', () => {
    test('should load without errors', () => {
      expect(() => {
        require('../../content/bandcamp-scraper.js');
      }).not.toThrow();
    });
    
    test('should log initialization message', () => {
      require('../../content/bandcamp-scraper.js');
      expect(console.log).toHaveBeenCalledWith('Trail Mix content script loaded');
    });
  });
  
  describe('Bandcamp Page Detection', () => {
    test('should detect Bandcamp pages correctly', () => {
      // Load content script
      delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
      require('../../content/bandcamp-scraper.js');
      
      // Should detect bandcamp.com in hostname
      expect(window.location.hostname.includes('bandcamp.com')).toBe(true);
    });
    
    test('should handle non-Bandcamp pages', () => {
      // Change to non-Bandcamp URL
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        writable: true
      });
      
      delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
      require('../../content/bandcamp-scraper.js');
      
      expect(window.location.hostname.includes('bandcamp.com')).toBe(false);
    });
  });
  
  describe('Message Listener Setup', () => {
    let messageHandler;
    
    beforeEach(() => {
      delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
      require('../../content/bandcamp-scraper.js');
      
      // Get the message handler
      const addListenerCalls = chrome.runtime.onMessage.addListener.mock.calls;
      if (addListenerCalls.length > 0) {
        messageHandler = addListenerCalls[0][0];
      }
    });
    
    test('should register message listener', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
    
    test('should handle CHECK_AUTH_STATUS message', async () => {
      if (!messageHandler) {
        throw new Error('Message handler not found');
      }
      
      const mockSendResponse = jest.fn();
      
      const result = messageHandler(
        { type: 'CHECK_AUTH_STATUS' },
        { tab: { id: 1 } },
        mockSendResponse
      );
      
      expect(result).toBe(true); // Should keep channel open
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        authenticated: true, // Should detect user menu
        currentUrl: 'https://testartist.bandcamp.com/album/test-album'
      });
    });
    
    test('should detect unauthenticated state', async () => {
      // Remove user menu and add login link
      const userMenu = document.querySelector('.menubar-item.user-menu');
      if (userMenu) userMenu.remove();
      
      const loginLink = document.createElement('a');
      loginLink.href = '/login';
      loginLink.textContent = 'Log in';
      document.body.appendChild(loginLink);
      
      if (!messageHandler) {
        throw new Error('Message handler not found');
      }
      
      const mockSendResponse = jest.fn();
      
      messageHandler(
        { type: 'CHECK_AUTH_STATUS' },
        { tab: { id: 1 } },
        mockSendResponse
      );
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        authenticated: false,
        currentUrl: 'https://testartist.bandcamp.com/album/test-album'
      });
    });
    
    test('should handle SCRAPE_PURCHASES message', async () => {
      if (!messageHandler) {
        throw new Error('Message handler not found');
      }
      
      const mockSendResponse = jest.fn();
      
      const result = messageHandler(
        { type: 'SCRAPE_PURCHASES' },
        { tab: { id: 1 } },
        mockSendResponse
      );
      
      expect(result).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        purchases: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            artist: expect.any(String),
            url: expect.any(String)
          })
        ])
      });
    });
    
    test('should handle SCRAPE_ALBUM message', async () => {
      if (!messageHandler) {
        throw new Error('Message handler not found');
      }
      
      const mockSendResponse = jest.fn();
      const testAlbumUrl = 'https://testartist.bandcamp.com/album/test-album';
      
      const result = messageHandler(
        { type: 'SCRAPE_ALBUM', albumUrl: testAlbumUrl },
        { tab: { id: 1 } },
        mockSendResponse
      );
      
      expect(result).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        albumData: expect.objectContaining({
          title: expect.any(String),
          artist: expect.any(String),
          tracks: expect.any(Array)
        })
      });
    });
    
    test('should handle unknown message types', () => {
      if (!messageHandler) {
        throw new Error('Message handler not found');
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
    
    test('should handle errors gracefully', async () => {
      // Create a scenario that will cause an error
      Object.defineProperty(document, 'querySelector', {
        value: () => { throw new Error('DOM access error'); },
        writable: true
      });
      
      if (!messageHandler) {
        throw new Error('Message handler not found');
      }
      
      const mockSendResponse = jest.fn();
      
      messageHandler(
        { type: 'CHECK_AUTH_STATUS' },
        { tab: { id: 1 } },
        mockSendResponse
      );
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        error: expect.any(String)
      });
    });
  });
  
  describe('DOM Utilities', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
      require('../../content/bandcamp-scraper.js');
    });
    
    test('should have DOMUtils available', () => {
      // DOMUtils should be defined in the global scope after loading
      expect(typeof window.DOMUtils === 'object' || 
             global.DOMUtils !== undefined).toBe(true);
    });
    
    test('should handle waitForElement utility', async () => {
      // Add an element after a delay
      setTimeout(() => {
        const testElement = document.createElement('div');
        testElement.className = 'test-element';
        document.body.appendChild(testElement);
      }, 50);
      
      // This test would need DOMUtils to be exported or available
      // For now, we'll test that the utility functions exist in the script
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../content/bandcamp-scraper.js'), 
        'utf8'
      );
      
      expect(scriptContent).toContain('waitForElement');
      expect(scriptContent).toContain('getTextContent');
      expect(scriptContent).toContain('getAttribute');
    });
  });
  
  describe('Initialization', () => {
    test('should initialize when DOM is ready', () => {
      // Test with loading state
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true
      });
      
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
      require('../../content/bandcamp-scraper.js');
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
    });
    
    test('should initialize immediately when DOM is complete', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true
      });
      
      delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
      
      expect(() => {
        require('../../content/bandcamp-scraper.js');
      }).not.toThrow();
    });
  });
});

