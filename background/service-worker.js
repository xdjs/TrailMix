/**
 * Trail Mix - Service Worker
 * Handles extension lifecycle and coordinates between components
 */

// Service worker runs independently - no external imports needed
console.log('Trail Mix service worker initializing...');

// Extension lifecycle management
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Trail Mix installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation - setting up defaults');
    initializeExtension();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated from version:', details.previousVersion);
  }
});

// Register startup listener
chrome.runtime.onStartup.addListener(() => {
  console.log('Trail Mix starting up');
});

// Initialize extension defaults
async function initializeExtension() {
  try {
    // Set default settings
    await chrome.storage.local.set({
      downloadLocation: '', // Will use browser default
      retryAttempts: 3,
      downloadDelay: 2000, // 2 seconds between downloads
      metadataEmbedding: true,
      artworkEmbedding: true
    });
    
    console.log('Extension initialized with default settings');
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Message handling between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message.type);
  
  switch (message.type) {
    case 'GET_EXTENSION_STATUS':
      handleGetStatus(sendResponse);
      return true; // Keep channel open for async response
      
    case 'START_DOWNLOAD':
      handleStartDownload(message.data, sendResponse);
      return true;
      
    case 'PAUSE_DOWNLOAD':
      handlePauseDownload(sendResponse);
      return true;
      
    case 'STOP_DOWNLOAD':
      handleStopDownload(sendResponse);
      return true;

    case 'CHECK_AUTHENTICATION':
      handleCheckAuthentication(sendResponse);
      return true;
      
    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Status handler
async function handleGetStatus(sendResponse) {
  try {
    const settings = await chrome.storage.local.get();
    sendResponse({ 
      status: 'ready',
      settings: settings 
    });
  } catch (error) {
    console.error('Failed to get status:', error);
    sendResponse({ error: error.message });
  }
}

// Download handlers (placeholder implementations)
function handleStartDownload(data, sendResponse) {
  console.log('Start download requested');
  // TODO: Implement download logic
  sendResponse({ status: 'started' });
}

function handlePauseDownload(sendResponse) {
  console.log('Pause download requested');
  // TODO: Implement pause logic
  sendResponse({ status: 'paused' });
}

function handleStopDownload(sendResponse) {
  console.log('Stop download requested');
  // TODO: Implement stop logic
  sendResponse({ status: 'stopped' });
}

// Enhanced authentication handler with better cookie detection
async function handleCheckAuthentication(sendResponse) {
  try {
    console.log('Checking authentication status...');
    
    // Get all Bandcamp cookies for analysis
    const allCookies = await chrome.cookies.getAll({
      domain: 'bandcamp.com'
    });
    
    const subdomainCookies = await chrome.cookies.getAll({
      domain: '.bandcamp.com'
    });
    
    const allBandcampCookies = [...allCookies, ...subdomainCookies];
    
    console.log('All Bandcamp cookies found:', allBandcampCookies.map(c => ({
      name: c.name,
      value: c.value ? `${c.value.substring(0, 20)}...` : 'empty',
      fullLength: c.value?.length || 0,
      domain: c.domain
    })));
    
    // Detailed session cookie analysis
    const sessionCookies = allBandcampCookies.filter(c => c.name.toLowerCase().includes('session'));
    console.log('=== DETAILED SESSION COOKIE ANALYSIS ===');
    sessionCookies.forEach(cookie => {
      const cookieValue = cookie.value ? cookie.value.trim() : '';
      const hasUrlEncoding = cookieValue.includes('%') && /%[0-9A-F]{2}/i.test(cookieValue);
      const looksLikeTracking = hasUrlEncoding || cookieValue.includes('t%3A') || cookieValue.includes('r%3A');
      
      console.log(`Cookie: ${cookie.name}`);
      console.log(`  Full Length: ${cookie.value?.length || 0}`);
      console.log(`  Value Preview: "${cookie.value ? cookie.value.substring(0, 30) : 'EMPTY'}"`);
      console.log(`  Domain: ${cookie.domain}`);
      console.log(`  Passes length test (>20): ${(cookie.value?.length || 0) > 20}`);
      console.log(`  Has URL encoding: ${hasUrlEncoding}`);
      console.log(`  Looks like tracking: ${looksLikeTracking}`);
      console.log(`  Would be considered auth: ${(cookie.value?.length || 0) > 20 && !looksLikeTracking}`);
      console.log('  ---');
    });
    
    // Look for known Bandcamp authentication indicators with stricter validation
    const authCookies = allBandcampCookies.filter(cookie => {
      const cookieName = cookie.name.toLowerCase();
      const cookieValue = cookie.value ? cookie.value.trim() : '';
      
      // Skip empty or very short values (likely not real auth data)
      if (!cookieValue || cookieValue.length < 5) {
        return false;
      }
      
      // Skip common non-auth values
      const nonAuthValues = ['null', 'undefined', '0', 'false', 'anonymous', 'guest'];
      if (nonAuthValues.includes(cookieValue.toLowerCase())) {
        return false;
      }
      
      // More specific authentication patterns
      const strongAuthPatterns = [
        'identity',      // Bandcamp user identity
        'fan_id',        // Fan ID  
        'logged_in',     // Login status
        'user_id',       // User ID
        'auth_token',    // Auth token
        'login_token',   // Login token
        'bc_user',       // Bandcamp user
        'client-id'      // Client identifier
      ];
      
      // Weaker patterns that need additional validation
      const weakAuthPatterns = ['session'];
      
      const hasStrongPattern = strongAuthPatterns.some(pattern => 
        cookieName.includes(pattern)
      );
      
      const hasWeakPattern = weakAuthPatterns.some(pattern => 
        cookieName.includes(pattern)
      );
      
      if (hasStrongPattern) {
        return true;
      }
      
      if (hasWeakPattern) {
        // For session cookies, require longer values that look like real session data
        // Exclude URL-encoded tracking data (contains %XX patterns)
        const hasUrlEncoding = cookieValue.includes('%') && /%[0-9A-F]{2}/i.test(cookieValue);
        const looksLikeTracking = hasUrlEncoding || cookieValue.includes('t%3A') || cookieValue.includes('r%3A');
        
        return cookieValue.length > 20 && 
               !cookieValue.includes('anonymous') &&
               !cookieValue.includes('guest') &&
               !looksLikeTracking;
      }
      
      return false;
    });
    
    // Additional check: look for any cookie that suggests authentication
    const significantCookies = allBandcampCookies.filter(cookie =>
      cookie.value && 
      cookie.value.length > 10 && // Ignore simple flags
      !cookie.name.includes('csrf') && // Ignore CSRF tokens
      !cookie.name.includes('_ga') && // Ignore Google Analytics
      !cookie.name.includes('utm')    // Ignore tracking
    );
    
    const isAuthenticated = authCookies.length > 0;
    
    console.log(`Found ${authCookies.length} authentication cookies`);
    console.log(`Found ${significantCookies.length} significant cookies`);
    console.log('Authentication cookies:', authCookies.map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0,
      valuePreview: c.value ? c.value.substring(0, 10) + '...' : 'empty'
    })));
    console.log('All session cookies:', allBandcampCookies
      .filter(c => c.name.toLowerCase().includes('session'))
      .map(c => ({
        name: c.name,
        valueLength: c.value?.length || 0,
        valuePreview: c.value ? c.value.substring(0, 10) + '...' : 'empty'
      }))
    );
    console.log('Authentication status:', isAuthenticated);
    
    sendResponse({
      isAuthenticated: isAuthenticated,
      userInfo: isAuthenticated ? { 
        method: 'service-worker-cookies',
        authCookies: authCookies.length,
        totalCookies: allBandcampCookies.length,
        cookieNames: authCookies.map(c => c.name)
      } : {
        method: 'service-worker-cookies',
        totalCookies: allBandcampCookies.length,
        cookieNames: allBandcampCookies.map(c => c.name)
      },
      lastChecked: Date.now(),
      cacheValid: false
    });

  } catch (error) {
    console.error('Authentication check failed:', error);
    sendResponse({
      error: error.message,
      isAuthenticated: false
    });
  }
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

