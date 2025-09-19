/**
 * Trail Mix - Authentication Manager Tests
 * Unit tests for session detection and authentication functionality
 */

const { AuthManager, authManager } = require('../../lib/auth-manager.js');

// Mock Chrome APIs
global.chrome = require('../mocks/chrome-mock.js');

// Mock utils
global.TrailMixUtils = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  sanitizeString: jest.fn((str) => str)
};

describe('AuthManager', () => {
  let testAuthManager;

  beforeEach(() => {
    // Create fresh instance for each test
    testAuthManager = new AuthManager();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset Chrome API mocks
    chrome.cookies.getAll.mockClear();
    chrome.tabs.query.mockClear();
    chrome.tabs.create.mockClear();
    chrome.tabs.sendMessage.mockClear();
    chrome.tabs.remove.mockClear();
    chrome.tabs.get.mockClear();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(testAuthManager.sessionCache).toEqual({
        isValid: null,
        lastChecked: null,
        userInfo: null
      });
      expect(testAuthManager.CACHE_DURATION).toBe(5 * 60 * 1000);
      expect(testAuthManager.BANDCAMP_DOMAIN).toBe('bandcamp.com');
    });

    test('should log initialization message', () => {
      expect(global.TrailMixUtils.logInfo).toHaveBeenCalledWith('AuthManager initialized');
    });
  });

  describe('isAuthenticated', () => {
    test('should return cached result when cache is valid', async () => {
      // Set up valid cache
      testAuthManager.sessionCache = {
        isValid: true,
        lastChecked: Date.now() - 1000, // 1 second ago
        userInfo: { fanId: '123' }
      };

      const result = await testAuthManager.isAuthenticated();
      
      expect(result).toBe(true);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith(
        'Using cached authentication status:', 
        true
      );
    });

    test('should perform fresh check when cache is invalid', async () => {
      // Mock validateSession to return true
      jest.spyOn(testAuthManager, 'validateSession').mockResolvedValue(true);

      const result = await testAuthManager.isAuthenticated();
      
      expect(result).toBe(true);
      expect(testAuthManager.validateSession).toHaveBeenCalled();
      expect(testAuthManager.sessionCache.isValid).toBe(true);
      expect(testAuthManager.sessionCache.lastChecked).toBeTruthy();
    });

    test('should return false on validation error', async () => {
      // Mock validateSession to throw error
      jest.spyOn(testAuthManager, 'validateSession').mockRejectedValue(new Error('Test error'));

      const result = await testAuthManager.isAuthenticated();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logError).toHaveBeenCalledWith(
        'Error checking authentication status:', 
        expect.any(Error)
      );
    });
  });

  describe('validateSession', () => {
    test('should return false when no valid cookies found', async () => {
      // Mock checkBandcampCookies to return false
      jest.spyOn(testAuthManager, 'checkBandcampCookies').mockResolvedValue(false);

      const result = await testAuthManager.validateSession();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('No valid Bandcamp cookies found');
    });

    test('should return false when API test fails', async () => {
      // Mock checkBandcampCookies to return true, but API test to fail
      jest.spyOn(testAuthManager, 'checkBandcampCookies').mockResolvedValue(true);
      jest.spyOn(testAuthManager, 'testSessionWithAPI').mockResolvedValue(false);

      const result = await testAuthManager.validateSession();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('Session API test failed');
    });

    test('should return true when both cookies and API test pass', async () => {
      // Mock both methods to return true
      jest.spyOn(testAuthManager, 'checkBandcampCookies').mockResolvedValue(true);
      jest.spyOn(testAuthManager, 'testSessionWithAPI').mockResolvedValue(true);

      const result = await testAuthManager.validateSession();
      
      expect(result).toBe(true);
      expect(global.TrailMixUtils.logInfo).toHaveBeenCalledWith('Bandcamp session validation successful');
    });

    test('should handle validation errors gracefully', async () => {
      // Mock checkBandcampCookies to throw error
      jest.spyOn(testAuthManager, 'checkBandcampCookies').mockRejectedValue(new Error('Cookie error'));

      const result = await testAuthManager.validateSession();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logError).toHaveBeenCalledWith(
        'Session validation failed:', 
        expect.any(Error)
      );
    });
  });

  describe('checkBandcampCookies', () => {
    test('should return false when no cookies found', async () => {
      chrome.cookies.getAll.mockResolvedValue([]);

      const result = await testAuthManager.checkBandcampCookies();
      
      expect(result).toBe(false);
      expect(chrome.cookies.getAll).toHaveBeenCalledWith({
        domain: 'bandcamp.com'
      });
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('No session cookies found');
    });

    test('should return false when no session cookies found', async () => {
      const mockCookies = [
        { name: 'other_cookie', value: 'value1' },
        { name: 'random_cookie', value: 'value2' }
      ];
      chrome.cookies.getAll.mockResolvedValue(mockCookies);

      const result = await testAuthManager.checkBandcampCookies();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('No session cookies found');
    });

    test('should return true when valid session cookies found', async () => {
      const mockCookies = [
        { name: 'session_id', value: 'valid_session_123' },
        { name: 'fan_id', value: '456' },
        { name: 'other_cookie', value: 'value' }
      ];
      chrome.cookies.getAll.mockResolvedValue(mockCookies);

      const result = await testAuthManager.checkBandcampCookies();
      
      expect(result).toBe(true);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('Found 2 valid session cookies');
    });

    test('should filter out empty session cookies', async () => {
      const mockCookies = [
        { name: 'session_id', value: '' },
        { name: 'fan_id', value: 'null' },
        { name: 'identity', value: 'valid_value' }
      ];
      chrome.cookies.getAll.mockResolvedValue(mockCookies);

      const result = await testAuthManager.checkBandcampCookies();
      
      expect(result).toBe(true);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('Found 1 valid session cookies');
    });

    test('should handle cookie API errors', async () => {
      chrome.cookies.getAll.mockRejectedValue(new Error('Cookie API error'));

      const result = await testAuthManager.checkBandcampCookies();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logError).toHaveBeenCalledWith(
        'Error checking Bandcamp cookies:', 
        expect.any(Error)
      );
    });
  });

  describe('testSessionWithAPI', () => {
    test('should return false when no response received', async () => {
      jest.spyOn(testAuthManager, 'makeAuthenticatedRequest').mockResolvedValue(null);

      const result = await testAuthManager.testSessionWithAPI();
      
      expect(result).toBe(false);
    });

    test('should return false when response indicates unauthorized', async () => {
      const mockResponse = { error: 'unauthorized', status: 'unauthorized' };
      jest.spyOn(testAuthManager, 'makeAuthenticatedRequest').mockResolvedValue(mockResponse);

      const result = await testAuthManager.testSessionWithAPI();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('API response indicates unauthenticated state');
    });

    test('should return true when response contains collection data', async () => {
      const mockResponse = { 
        fan_id: '123', 
        collection_count: 42 
      };
      jest.spyOn(testAuthManager, 'makeAuthenticatedRequest').mockResolvedValue(mockResponse);

      const result = await testAuthManager.testSessionWithAPI();
      
      expect(result).toBe(true);
      expect(global.TrailMixUtils.logDebug).toHaveBeenCalledWith('API response confirms authenticated state');
      expect(testAuthManager.sessionCache.userInfo).toEqual({
        fanId: '123',
        collectionCount: 42
      });
    });

    test('should handle API errors gracefully', async () => {
      jest.spyOn(testAuthManager, 'makeAuthenticatedRequest').mockRejectedValue(new Error('API error'));

      const result = await testAuthManager.testSessionWithAPI();
      
      expect(result).toBe(false);
      expect(global.TrailMixUtils.logError).toHaveBeenCalledWith(
        'API session test failed:', 
        expect.any(Error)
      );
    });
  });

  describe('makeAuthenticatedRequest', () => {
    test('should use existing Bandcamp tab when available', async () => {
      const mockTab = { id: 123, url: 'https://bandcamp.com' };
      chrome.tabs.query.mockResolvedValue([mockTab]);
      chrome.tabs.sendMessage.mockResolvedValue({ success: true });

      const result = await testAuthManager.makeAuthenticatedRequest('https://api.bandcamp.com/test');
      
      expect(chrome.tabs.query).toHaveBeenCalledWith({ 
        url: '*://*.bandcamp.com/*' 
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        action: 'makeAuthenticatedRequest',
        url: 'https://api.bandcamp.com/test'
      });
      expect(result).toEqual({ success: true });
    });

    test('should create temporary tab when no Bandcamp tabs exist', async () => {
      const mockTab = { id: 456 };
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue(mockTab);
      chrome.tabs.get.mockResolvedValue({ status: 'complete' });
      chrome.tabs.sendMessage.mockResolvedValue({ success: true });
      chrome.tabs.remove.mockResolvedValue();

      const result = await testAuthManager.makeAuthenticatedRequest('https://api.bandcamp.com/test');
      
      expect(chrome.tabs.create).toHaveBeenCalledWith({ 
        url: 'https://bandcamp.com',
        active: false 
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(456, {
        action: 'makeAuthenticatedRequest',
        url: 'https://api.bandcamp.com/test'
      });
      expect(chrome.tabs.remove).toHaveBeenCalledWith(456);
      expect(result).toEqual({ success: true });
    });

    test('should handle request errors gracefully', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Tab query failed'));

      const result = await testAuthManager.makeAuthenticatedRequest('https://api.bandcamp.com/test');
      
      expect(result).toBeNull();
      expect(global.TrailMixUtils.logError).toHaveBeenCalledWith(
        'Error making authenticated request:', 
        expect.any(Error)
      );
    });
  });

  describe('Cache Management', () => {
    test('isCacheValid should return false when no lastChecked', () => {
      testAuthManager.sessionCache.lastChecked = null;
      
      expect(testAuthManager.isCacheValid()).toBe(false);
    });

    test('isCacheValid should return true when cache is recent', () => {
      testAuthManager.sessionCache.lastChecked = Date.now() - 1000; // 1 second ago
      
      expect(testAuthManager.isCacheValid()).toBe(true);
    });

    test('isCacheValid should return false when cache is expired', () => {
      testAuthManager.sessionCache.lastChecked = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      
      expect(testAuthManager.isCacheValid()).toBe(false);
    });

    test('updateCache should update cache with new status', () => {
      const beforeTime = Date.now();
      testAuthManager.updateCache(true);
      const afterTime = Date.now();
      
      expect(testAuthManager.sessionCache.isValid).toBe(true);
      expect(testAuthManager.sessionCache.lastChecked).toBeGreaterThanOrEqual(beforeTime);
      expect(testAuthManager.sessionCache.lastChecked).toBeLessThanOrEqual(afterTime);
    });

    test('clearCache should reset all cache values', () => {
      testAuthManager.sessionCache = {
        isValid: true,
        lastChecked: Date.now(),
        userInfo: { fanId: '123' }
      };
      
      testAuthManager.clearCache();
      
      expect(testAuthManager.sessionCache).toEqual({
        isValid: null,
        lastChecked: null,
        userInfo: null
      });
    });
  });

  describe('Utility Methods', () => {
    test('getUserInfo should return cached user info', () => {
      const mockUserInfo = { fanId: '123', collectionCount: 42 };
      testAuthManager.sessionCache.userInfo = mockUserInfo;
      
      expect(testAuthManager.getUserInfo()).toEqual(mockUserInfo);
    });

    test('refreshAuthStatus should clear cache and check authentication', async () => {
      jest.spyOn(testAuthManager, 'clearCache');
      jest.spyOn(testAuthManager, 'isAuthenticated').mockResolvedValue(true);
      
      const result = await testAuthManager.refreshAuthStatus();
      
      expect(testAuthManager.clearCache).toHaveBeenCalled();
      expect(testAuthManager.isAuthenticated).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('requiresLogin should return opposite of isAuthenticated', async () => {
      jest.spyOn(testAuthManager, 'isAuthenticated').mockResolvedValue(true);
      
      const result = await testAuthManager.requiresLogin();
      
      expect(result).toBe(false);
    });

    test('getAuthStatus should return comprehensive status object', async () => {
      const mockUserInfo = { fanId: '123' };
      testAuthManager.sessionCache = {
        isValid: true,
        lastChecked: 1234567890,
        userInfo: mockUserInfo
      };
      jest.spyOn(testAuthManager, 'isAuthenticated').mockResolvedValue(true);
      jest.spyOn(testAuthManager, 'isCacheValid').mockReturnValue(true);
      
      const result = await testAuthManager.getAuthStatus();
      
      expect(result).toEqual({
        isAuthenticated: true,
        userInfo: mockUserInfo,
        lastChecked: 1234567890,
        cacheValid: true
      });
    });
  });

  describe('Singleton Instance', () => {
    test('should export singleton authManager instance', () => {
      expect(authManager).toBeInstanceOf(AuthManager);
    });
  });
});
