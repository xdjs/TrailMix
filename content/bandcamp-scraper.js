/**
 * Trail Mix - Content Script
 * Handles DOM interaction with Bandcamp pages
 */

console.log('Trail Mix content script loaded');

// DOM Utilities for content script
const DOMUtils = {
  waitForElement: async (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
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

// Export for testing
if (typeof global !== 'undefined') {
  global.DOMUtils = DOMUtils;
}
if (typeof window !== 'undefined') {
  window.DOMUtils = DOMUtils;
}

// Initialize function (exported for testing)
function initialize() {
  console.log('Trail Mix: DOM ready, initializing...');
  
  // Check if we're on a Bandcamp page
  if (!isBandcampPage()) {
    console.log('Not a Bandcamp page, content script inactive');
    return;
  }
  
  console.log('Bandcamp page detected, content script active');
  setupMessageListener();
}

// Wait for DOM to be ready (skip in test environment)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
} else if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('bandcamp.com')) {
  // In test environment with mocked window
  initialize();
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
      case 'NAVIGATE_TO_PURCHASES':
        handleNavigateToPurchases(sendResponse);
        return true;

      case 'SCRAPE_PURCHASES':
        handleScrapePurchases(sendResponse);
        return true; // Keep channel open for async response

      case 'SCRAPE_ALBUM':
        handleScrapeAlbum(message.albumUrl, sendResponse);
        return true;

      case 'GET_DOWNLOAD_LINK':
        handleGetDownloadLink(message.albumUrl, sendResponse);
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
    console.log('Checking auth status...');

    // Look for authentication indicators in the DOM
    const loginLink = document.querySelector('a[href*="/login"]');
    const userMenu = document.querySelector('.menubar-item.user-menu');
    const isLoggedIn = !loginLink && !!userMenu;

    console.log('Login status:', { isLoggedIn, hasLoginLink: !!loginLink, hasUserMenu: !!userMenu });

    // Try to get username from various places on the page
    let username = null;

    // Log all links that might contain username
    const allLinks = document.querySelectorAll('a[href*="bandcamp.com/"]');
    console.log('All Bandcamp links found:', Array.from(allLinks).map(l => l.href));

    // Method 1: Try finding the user's collection/profile link in header
    const headerLinks = document.querySelectorAll('.menubar a[href*="bandcamp.com/"], .user-nav a[href*="bandcamp.com/"]');
    console.log('Header links:', Array.from(headerLinks).map(l => ({ href: l.href, text: l.textContent })));

    for (const link of headerLinks) {
      // Look for links like bandcamp.com/carlxt
      const match = link.href.match(/bandcamp\.com\/([^\/\?]+)(?:\/|$)/);
      if (match && match[1] && !['login', 'signup', 'help', 'discover', 'feed'].includes(match[1])) {
        username = match[1];
        console.log('Found username from header link:', username);
        break;
      }
    }

    // Method 2: Check the user image/avatar link
    if (!username) {
      const userImage = document.querySelector('.user-image a, .menubar .user-pic a, a.user-image');
      console.log('User image link:', userImage?.href);
      if (userImage && userImage.href) {
        const match = userImage.href.match(/bandcamp\.com\/([^\/\?]+)/);
        if (match && match[1]) {
          username = match[1];
          console.log('Found username from user image:', username);
        }
      }
    }

    // Method 3: Try the dropdown menu when clicked
    if (!username) {
      const userMenuItems = document.querySelectorAll('.user-menu-dropdown a, .menubar-dropdown a');
      console.log('Dropdown menu items:', Array.from(userMenuItems).map(l => l.href));
      for (const item of userMenuItems) {
        if (item.href && item.href.includes('bandcamp.com/')) {
          const match = item.href.match(/bandcamp\.com\/([^\/\?]+)/);
          if (match && match[1] && !['login', 'signup', 'help'].includes(match[1])) {
            username = match[1];
            console.log('Found username from dropdown:', username);
            break;
          }
        }
      }
    }

    // Method 4: Look for "view collection" type links
    if (!username) {
      const collectionLinks = document.querySelectorAll('a[href*="collection"], a[href*="purchases"]');
      console.log('Collection links:', Array.from(collectionLinks).map(l => l.href));
      for (const link of collectionLinks) {
        const match = link.href.match(/bandcamp\.com\/([^\/\?]+)/);
        if (match && match[1]) {
          username = match[1];
          console.log('Found username from collection link:', username);
          break;
        }
      }
    }

    console.log('Final auth status:', { isLoggedIn, username, currentUrl: window.location.href });

    sendResponse({
      authenticated: isLoggedIn,
      username: username,
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

// Navigate to purchases page
async function handleNavigateToPurchases(sendResponse) {
  try {
    // Check if we're already on the purchases page
    if (window.location.pathname.includes('/purchases')) {
      sendResponse({ success: true, message: 'Already on purchases page' });
      return;
    }

    // Find the user menu and navigate to purchases
    const userMenu = document.querySelector('.menubar-item.user-menu, .user-nav');
    if (!userMenu) {
      // Try to find the username link directly
      const usernameLink = document.querySelector('a[href*="/purchases"]');
      if (usernameLink) {
        window.location.href = usernameLink.href;
        sendResponse({ success: true, message: 'Navigating to purchases page' });
      } else {
        // Get current username from page and construct purchases URL
        const fanNameElement = document.querySelector('.name a, .fan-name');
        if (fanNameElement) {
          const username = fanNameElement.textContent.trim();
          window.location.href = `https://bandcamp.com/${username}/purchases`;
          sendResponse({ success: true, message: 'Navigating to purchases page' });
        } else {
          sendResponse({ error: 'Could not find purchases page link' });
        }
      }
    } else {
      // Click on user menu to reveal dropdown
      userMenu.click();
      await new Promise(resolve => setTimeout(resolve, 100));

      const purchasesLink = document.querySelector('a[href*="/purchases"]');
      if (purchasesLink) {
        window.location.href = purchasesLink.href;
        sendResponse({ success: true, message: 'Navigating to purchases page' });
      } else {
        sendResponse({ error: 'Could not find purchases link in menu' });
      }
    }
  } catch (error) {
    console.error('Error navigating to purchases:', error);
    sendResponse({ error: error.message });
  }
}

// Scrape purchases page
async function handleScrapePurchases(sendResponse) {
  try {
    console.log('Scraping collection page...');

    // Check if we're on a user collection page (format: bandcamp.com/username)
    const isCollectionPage = window.location.hostname === 'bandcamp.com' &&
                            (window.location.pathname.match(/^\/[^\/]+\/?$/) ||
                             window.location.pathname.includes('/collection'));

    if (!isCollectionPage) {
      sendResponse({ error: 'Not on collection page' });
      return;
    }

    // Wait for collection items to load
    try {
      await DOMUtils.waitForElement('.collection-grid, .collection-items, .collection-item-container, ol.collection-grid', 10000);
    } catch (err) {
      console.log('No collection grid found, checking for other selectors...');
    }

    // Find all purchase items - try multiple selectors for the collection page
    const purchaseSelectors = [
      'ol.collection-grid li.collection-item-container',  // Main collection grid items
      'li.collection-item-container',
      '.collection-grid .collection-item-container',
      '.collection-items .collection-item-container',
      '.collection-item',
      'li[data-itemid]',  // Items with data attributes
      '.fan-collection li'
    ];

    let purchaseElements = [];
    for (const selector of purchaseSelectors) {
      purchaseElements = document.querySelectorAll(selector);
      if (purchaseElements.length > 0) {
        console.log(`Found ${purchaseElements.length} items using selector: ${selector}`);
        break;
      }
    }

    if (purchaseElements.length === 0) {
      sendResponse({
        success: true,
        purchases: [],
        message: 'No purchases found on page'
      });
      return;
    }

    const purchases = [];

    for (const element of purchaseElements) {
      try {
        // Extract album/track title
        const titleElement = element.querySelector('.collection-item-title, .item-title, a.item-link');
        const title = DOMUtils.getTextContent(titleElement);

        // Extract artist name
        const artistElement = element.querySelector('.collection-item-artist, .item-artist, .by-artist a');
        const artist = DOMUtils.getTextContent(artistElement).replace(/^by\s+/, '');

        // Extract URL
        const linkElement = element.querySelector('a.item-link, a.collection-item-link, a[href*="/album/"], a[href*="/track/"]');
        const url = linkElement ? linkElement.href : '';

        // Extract artwork URL
        const artworkElement = element.querySelector('img.collection-item-art, img.item-art, img[src*=".jpg"], img[src*=".png"]');
        const artworkUrl = artworkElement ? artworkElement.src : '';

        // Extract purchase date if available
        const dateElement = element.querySelector('.collection-item-date, .purchase-date');
        const purchaseDate = DOMUtils.getTextContent(dateElement);

        // Extract item type (album or track)
        const itemType = url.includes('/track/') ? 'track' : 'album';

        if (title && url) {
          purchases.push({
            title,
            artist: artist || 'Unknown Artist',
            url,
            artworkUrl,
            purchaseDate: purchaseDate || '',
            itemType
          });
        }
      } catch (err) {
        console.error('Error parsing purchase item:', err);
      }
    }

    console.log(`Successfully scraped ${purchases.length} purchases`);

    sendResponse({
      success: true,
      purchases,
      totalCount: purchases.length
    });

  } catch (error) {
    console.error('Error scraping purchases:', error);
    sendResponse({ error: error.message });
  }
}

// Get download link for an album
async function handleGetDownloadLink(albumUrl, sendResponse) {
  try {
    console.log('Getting download link for:', albumUrl);

    // Navigate to album page if not already there
    if (window.location.href !== albumUrl) {
      window.location.href = albumUrl;
      sendResponse({ navigating: true, message: 'Navigating to album page' });
      return;
    }

    // Look for download link - purchased items have a "download" link
    const downloadSelectors = [
      'a[href*="/download/album"]',
      'a[href*="/download/track"]',
      'a.download-link',
      '.download-col a',
      'a:contains("download")',
      'span.buyItem a[href*="download"]'
    ];

    let downloadLink = null;
    for (const selector of downloadSelectors) {
      const element = document.querySelector(selector);
      if (element && element.href) {
        downloadLink = element.href;
        break;
      }
    }

    // If no direct download link, check if there's a "you own this" indicator
    const ownedIndicators = [
      '.you-own-this',
      'span:contains("you own this")',
      '.ownership',
      '.download-link-container'
    ];

    let isOwned = false;
    for (const selector of ownedIndicators) {
      const element = document.querySelector(selector);
      if (element) {
        isOwned = true;
        break;
      }
    }

    if (downloadLink) {
      sendResponse({
        success: true,
        downloadUrl: downloadLink,
        isOwned: true
      });
    } else if (isOwned) {
      // Item is owned but download link not immediately visible
      // May need to click something to reveal it
      sendResponse({
        success: false,
        isOwned: true,
        message: 'Item owned but download link not found'
      });
    } else {
      sendResponse({
        success: false,
        isOwned: false,
        message: 'Item not owned or download link not found'
      });
    }

  } catch (error) {
    console.error('Error getting download link:', error);
    sendResponse({ error: error.message });
  }
}

// Scrape individual album page for metadata
async function handleScrapeAlbum(albumUrl, sendResponse) {
  try {
    console.log('Scraping album:', albumUrl);

    // Navigate to album page if not already there
    if (window.location.href !== albumUrl) {
      window.location.href = albumUrl;
      sendResponse({ navigating: true, message: 'Navigating to album page' });
      return;
    }

    // Extract album metadata
    const albumTitle = DOMUtils.getTextContent(document.querySelector('#name-section h2, .trackTitle'));
    const artistName = DOMUtils.getTextContent(document.querySelector('#name-section h3 span a, .albumTitle span'));
    const releaseDate = DOMUtils.getTextContent(document.querySelector('.tralbum-credits, .released'));

    // Extract track list
    const tracks = [];
    const trackElements = document.querySelectorAll('.track_list tr.track_row_view, table.track_list tr');

    trackElements.forEach((trackEl, index) => {
      const titleEl = trackEl.querySelector('.title-col .track-title, .title a span');
      const durationEl = trackEl.querySelector('.time, .duration');

      if (titleEl) {
        tracks.push({
          number: index + 1,
          title: DOMUtils.getTextContent(titleEl),
          duration: DOMUtils.getTextContent(durationEl)
        });
      }
    });

    // Get high-res artwork
    const artworkEl = document.querySelector('#tralbumArt img, .popupImage img, a.popupImage');
    const artworkUrl = artworkEl ? (artworkEl.src || artworkEl.href) : '';

    sendResponse({
      success: true,
      albumData: {
        title: albumTitle || 'Unknown Album',
        artist: artistName || 'Unknown Artist',
        releaseDate,
        tracks,
        artworkUrl,
        url: albumUrl
      }
    });

  } catch (error) {
    console.error('Error scraping album:', error);
    sendResponse({ error: error.message });
  }
}

console.log('Trail Mix content script fully initialized');

