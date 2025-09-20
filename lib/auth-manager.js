/**
 * Trail Mix - Authentication Manager
 * Handles user authentication and session management for Bandcamp
 * 
 * Features:
 * - Session cookie management
 * - Login state detection
 * - Bandcamp session validation
 * - Authentication state management
 * - Session expiry detection
 */

// Import utilities (with fallbacks for testing)
const utils = (typeof window !== 'undefined' && window.TrailMixUtils) || global.TrailMixUtils || {};
const logInfo = utils.logInfo || console.log;
const logError = utils.logError || console.error;
const logDebug = utils.logDebug || console.log;
const sanitizeString = utils.sanitizeString || ((str) => str);

/**
 * Authentication Manager Class
 * Manages Bandcamp authentication state and session validation
 */
class AuthManager {
  constructor() {
    this.sessionCache = {
      isValid: null,
      lastChecked: null,
      userInfo: null
    };
    
    // Cache duration: 5 minutes
    this.CACHE_DURATION = 5 * 60 * 1000;
    
    // Bandcamp authentication endpoints and selectors
    this.BANDCAMP_DOMAIN = 'bandcamp.com';
    this.LOGIN_URL = 'https://bandcamp.com/login';
    this.SESSION_CHECK_URL = 'https://bandcamp.com/api/fan/2/collection_summary';
    
    logInfo('AuthManager initialized');
  }

  /**
   * Check if user is currently authenticated with Bandcamp
   * Uses cached result if recent, otherwise performs fresh check
   * @returns {Promise<boolean>} True if authenticated, false otherwise
   */
  async isAuthenticated() {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        logDebug('Using cached authentication status:', this.sessionCache.isValid);
        return this.sessionCache.isValid;
      }

      // Perform fresh authentication check
      const isValid = await this.validateSession();
      
      // Update cache
      this.updateCache(isValid);
      
      return isValid;
    } catch (error) {
      logError('Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * Validate current session by checking Bandcamp cookies and API response
   * @returns {Promise<boolean>} True if session is valid, false otherwise
   */
  async validateSession() {
    try {
      logDebug('Validating Bandcamp session...');

      // Step 1: Check for essential Bandcamp cookies
      const hasValidCookies = await this.checkBandcampCookies();
      if (!hasValidCookies) {
        logDebug('No valid Bandcamp cookies found');
        return false;
      }

      // Step 2: Test session with API call
      const apiResponse = await this.testSessionWithAPI();
      if (!apiResponse) {
        logDebug('Session API test failed');
        return false;
      }

      logInfo('Bandcamp session validation successful');
      return true;

    } catch (error) {
      logError('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Check for essential Bandcamp authentication cookies
   * @returns {Promise<boolean>} True if valid cookies exist
   */
  async checkBandcampCookies() {
    try {
      // Get all cookies for Bandcamp domain
      const cookies = await chrome.cookies.getAll({
        domain: this.BANDCAMP_DOMAIN
      });

      logDebug(`Found ${cookies.length} Bandcamp cookies`);

      // Look for session-related cookies
      const sessionCookies = cookies.filter(cookie => {
        return cookie.name.includes('session') || 
               cookie.name.includes('identity') ||
               cookie.name.includes('fan_id') ||
               cookie.name === 'js_logged_in';
      });

      if (sessionCookies.length === 0) {
        logDebug('No session cookies found');
        return false;
      }

      // Check if any session cookies have values
      const validSessionCookies = sessionCookies.filter(cookie => 
        cookie.value && cookie.value.length > 0 && cookie.value !== 'null'
      );

      logDebug(`Found ${validSessionCookies.length} valid session cookies`);
      return validSessionCookies.length > 0;

    } catch (error) {
      logError('Error checking Bandcamp cookies:', error);
      return false;
    }
  }

  /**
   * Test session validity by making API call to Bandcamp
   * @returns {Promise<boolean>} True if API call succeeds with auth
   */
  async testSessionWithAPI() {
    try {
      logDebug('Testing session with Bandcamp API...');

      // Use content script to make authenticated request
      const response = await this.makeAuthenticatedRequest(this.SESSION_CHECK_URL);
      
      if (!response) {
        return false;
      }

      // Check if response indicates authenticated state
      if (response.error || response.status === 'unauthorized') {
        logDebug('API response indicates unauthenticated state');
        return false;
      }

      // If we get collection data, user is authenticated
      if (response.collection_count !== undefined || response.fan_id) {
        logDebug('API response confirms authenticated state');
        this.sessionCache.userInfo = {
          fanId: response.fan_id,
          collectionCount: response.collection_count
        };
        return true;
      }

      return false;

    } catch (error) {
      logError('API session test failed:', error);
      return false;
    }
  }

  /**
   * Make authenticated request via content script
   * @param {string} url - URL to request
   * @returns {Promise<Object|null>} Response data or null if failed
   */
  async makeAuthenticatedRequest(url) {
    try {
      // Send message to content script to make the request
      const tabs = await chrome.tabs.query({ 
        url: `*://*.${this.BANDCAMP_DOMAIN}/*` 
      });

      if (tabs.length === 0) {
        // No Bandcamp tabs open, create one temporarily
        const tab = await chrome.tabs.create({ 
          url: 'https://bandcamp.com',
          active: false 
        });

        // Wait for tab to load
        await this.waitForTabLoad(tab.id);
        
        // Make request
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'makeAuthenticatedRequest',
          url: url
        });

        // Close temporary tab
        await chrome.tabs.remove(tab.id);
        
        return response;
      } else {
        // Use existing Bandcamp tab
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'makeAuthenticatedRequest',
          url: url
        });
        
        return response;
      }

    } catch (error) {
      logError('Error making authenticated request:', error);
      return null;
    }
  }

  /**
   * Wait for tab to finish loading
   * @param {number} tabId - Tab ID to wait for
   * @returns {Promise<void>}
   */
  async waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') {
            resolve();
          } else {
            setTimeout(checkTab, 100);
          }
        } catch (error) {
          resolve(); // Tab might be closed, resolve anyway
        }
      };
      
      setTimeout(checkTab, 1000); // Initial delay
    });
  }

  /**
   * Check if cached authentication status is still valid
   * @returns {boolean} True if cache is valid and recent
   */
  isCacheValid() {
    if (!this.sessionCache.lastChecked) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.sessionCache.lastChecked;
    
    return cacheAge < this.CACHE_DURATION;
  }

  /**
   * Update authentication cache with new status
   * @param {boolean} isValid - Current authentication status
   */
  updateCache(isValid) {
    this.sessionCache.isValid = isValid;
    this.sessionCache.lastChecked = Date.now();
    
    logDebug('Authentication cache updated:', { 
      isValid, 
      timestamp: this.sessionCache.lastChecked 
    });
  }

  /**
   * Clear authentication cache
   */
  clearCache() {
    this.sessionCache = {
      isValid: null,
      lastChecked: null,
      userInfo: null
    };
    
    logDebug('Authentication cache cleared');
  }

  /**
   * Get cached user information
   * @returns {Object|null} User info if available
   */
  getUserInfo() {
    return this.sessionCache.userInfo;
  }

  /**
   * Force refresh authentication status (bypass cache)
   * @returns {Promise<boolean>} Current authentication status
   */
  async refreshAuthStatus() {
    logDebug('Forcing authentication status refresh...');
    this.clearCache();
    return await this.isAuthenticated();
  }

  /**
   * Check if user needs to login
   * @returns {Promise<boolean>} True if login is required
   */
  async requiresLogin() {
    const isAuth = await this.isAuthenticated();
    return !isAuth;
  }

  /**
   * Get authentication status summary
   * @returns {Promise<Object>} Status summary object
   */
  async getAuthStatus() {
    const isAuthenticated = await this.isAuthenticated();
    
    return {
      isAuthenticated,
      userInfo: this.getUserInfo(),
      lastChecked: this.sessionCache.lastChecked,
      cacheValid: this.isCacheValid()
    };
  }
}

// Create singleton instance
const authManager = new AuthManager();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js/Jest environment
  module.exports = {
    AuthManager,
    authManager
  };
} else {
  // Browser environment (check if window exists)
  if (typeof window !== 'undefined') {
    window.TrailMixAuth = {
      AuthManager,
      authManager
    };
  } else if (typeof self !== 'undefined') {
    // Service worker environment
    self.TrailMixAuth = {
      AuthManager,
      authManager
    };
  } else {
    // Fallback - create global
    global.TrailMixAuth = {
      AuthManager,
      authManager
    };
  }
}

logInfo('Trail Mix Authentication Manager loaded successfully');