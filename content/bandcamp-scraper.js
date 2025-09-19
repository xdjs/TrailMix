/**
 * Trail Mix - Content Script
 * Handles DOM interaction with Bandcamp pages
 */

console.log('Trail Mix content script loaded');

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

function initialize() {
  console.log('Bandcamp Downloader: DOM ready, initializing...');
  
  // Check if we're on a Bandcamp page
  if (!isBandcampPage()) {
    console.log('Not a Bandcamp page, content script inactive');
    return;
  }
  
  console.log('Bandcamp page detected, content script active');
  setupMessageListener();
}

// Check if current page is a Bandcamp page
function isBandcampPage() {
  return window.location.hostname.includes('bandcamp.com');
}

// Set up message listener for communication with background script
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.type);
    
    switch (message.type) {
      case 'SCRAPE_PURCHASES':
        handleScrapePurchases(sendResponse);
        return true; // Keep channel open for async response
        
      case 'SCRAPE_ALBUM':
        handleScrapeAlbum(message.albumUrl, sendResponse);
        return true;
        
      case 'CHECK_AUTH_STATUS':
        handleCheckAuthStatus(sendResponse);
        return true;

      case 'makeAuthenticatedRequest':
        handleAuthenticatedRequest(message.url, sendResponse);
        return true;
        
      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  });
}

// Check if user is authenticated
async function handleCheckAuthStatus(sendResponse) {
  try {
    // Look for authentication indicators in the DOM
    const loginLink = document.querySelector('a[href*="/login"]');
    const userMenu = document.querySelector('.menubar-item.user-menu');
    const isLoggedIn = !loginLink && !!userMenu;
    
    sendResponse({ 
      authenticated: isLoggedIn,
      currentUrl: window.location.href 
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    sendResponse({ error: error.message });
  }
}

// Handle authenticated API requests
async function handleAuthenticatedRequest(url, sendResponse) {
  try {
    console.log('Making authenticated request to:', url);
    
    // Make fetch request with credentials (cookies will be included)
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Try to parse as JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log('Authenticated request successful');
    sendResponse(data);

  } catch (error) {
    console.error('Authenticated request failed:', error);
    sendResponse({ 
      error: error.message,
      status: 'unauthorized'
    });
  }
}

// Scrape purchases page (placeholder implementation)
async function handleScrapePurchases(sendResponse) {
  try {
    console.log('Scraping purchases page...');
    
    // TODO: Implement actual purchases scraping logic
    // This is a placeholder that will be implemented in Phase 3
    
    const mockPurchases = [
      {
        title: 'Sample Album',
        artist: 'Sample Artist',
        url: 'https://sampleartist.bandcamp.com/album/sample-album',
        purchaseDate: '2023-01-01',
        artworkUrl: 'https://example.com/artwork.jpg'
      }
    ];
    
    sendResponse({ 
      success: true, 
      purchases: mockPurchases 
    });
  } catch (error) {
    console.error('Error scraping purchases:', error);
    sendResponse({ error: error.message });
  }
}

// Scrape individual album page (placeholder implementation)
async function handleScrapeAlbum(albumUrl, sendResponse) {
  try {
    console.log('Scraping album:', albumUrl);
    
    // TODO: Implement actual album scraping logic
    // This is a placeholder that will be implemented in Phase 3
    
    const mockAlbumData = {
      title: 'Sample Album',
      artist: 'Sample Artist',
      tracks: [
        { number: 1, title: 'Track One', duration: '3:45' },
        { number: 2, title: 'Track Two', duration: '4:12' }
      ],
      downloadUrl: 'https://example.com/download'
    };
    
    sendResponse({ 
      success: true, 
      albumData: mockAlbumData 
    });
  } catch (error) {
    console.error('Error scraping album:', error);
    sendResponse({ error: error.message });
  }
}

// Utility functions for DOM manipulation
const DOMUtils = {
  // Wait for element to appear in DOM
  waitForElement: (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },
  
  // Safe text extraction
  getTextContent: (element) => {
    return element ? element.textContent.trim() : '';
  },
  
  // Safe attribute extraction
  getAttribute: (element, attribute) => {
    return element ? element.getAttribute(attribute) : null;
  }
};

console.log('Bandcamp Downloader content script initialized');

