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
let __trailMixInitialized = false;

// Reserved usernames that are not real fan profiles
const RESERVED_USERNAMES = new Set([
  'login','signup','help','discover','feed','community','tag','search'
]);

/**
 * Extract Bandcamp username from the current page using multiple strategies:
 * 1. URL path segment on bandcamp.com (highest priority)
 * 2. Open Graph meta tag (og:url)
 * 3. Collection button or explicit "Collection" link to bandcamp.com
 * 4. Header navigation links (menubar/user-nav)
 * 5. Fallback links to bandcamp.com with ?from= query
 * Returns null if no suitable username is found.
 */
function findUsernameOnPage() {
  try {
    const reserved = RESERVED_USERNAMES;

    const extractFromHref = (href) => {
      if (!href) return null;
      const m = String(href).match(/bandcamp\.com\/([^\/?#]+)(?:[\/?#]|$)/);
      if (!m || !m[1]) return null;
      const candidate = m[1];
      return reserved.has(candidate) ? null : candidate;
    };

    // Strategy 1: path segment on bandcamp.com
    try {
      const host = window && window.location && window.location.hostname;
      const path = (window && window.location && typeof window.location.pathname === 'string') ? window.location.pathname : '/';
      if (host === 'bandcamp.com') {
        const seg = (path || '/').split('/').filter(Boolean);
        if (seg.length >= 1) {
          const candidate = seg[0];
          if (candidate && !reserved.has(candidate)) {
            return candidate;
          }
        }
      }
    } catch (_) {}

    // Strategy 2: meta og:url
    try {
      const og = document.querySelector('meta[property="og:url"]');
      const href = og && og.getAttribute('content');
      const fromOg = extractFromHref(href);
      if (fromOg) return fromOg;
    } catch (_) {}

    // Strategy 3: Collection button or explicit "collection" text link
    try {
      const collectionButton = document.querySelector('a[href*="?from=menubar"]') ||
        Array.from(document.querySelectorAll('a')).find(link =>
          (link.textContent || '').trim().toLowerCase() === 'collection' && String(link.href).includes('bandcamp.com')
        );
      const fromCollection = extractFromHref(collectionButton && collectionButton.href);
      if (fromCollection) return fromCollection;
    } catch (_) {}

    // Strategy 4: Other header links (menubar, user-nav)
    try {
      const headerLinks = document.querySelectorAll('.menubar a[href*="bandcamp.com/"], .user-nav a[href*="bandcamp.com/"]');
      for (const link of headerLinks) {
        const fromHeader = extractFromHref(link && link.href);
        if (fromHeader) return fromHeader;
      }
    } catch (_) {}

    // Strategy 5: Fallback selectors for profile links with query params
    try {
      const usernameSelectors = [
        'a[href*="bandcamp.com/"][href*="?from="]',
        '.menubar a[href^="https://bandcamp.com/"]'
      ];
      for (const selector of usernameSelectors) {
        const element = document.querySelector(selector);
        const fromFallback = extractFromHref(element && element.href);
        if (fromFallback) return fromFallback;
      }
    } catch (_) {}

    return null;
  } catch (_) {
    return null;
  }
}

// Export for testing only
try {
  if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    window.findUsernameOnPage = findUsernameOnPage;
  }
} catch (_) {}
function initialize() {
  if (__trailMixInitialized) return;
  __trailMixInitialized = true;
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
    // Also initialize early in test/JSdom to register listeners
    try {
      if (typeof navigator !== 'undefined' && String(navigator.userAgent || '').toLowerCase().includes('jsdom')) {
        initialize();
      }
    } catch (_) {}
  } else {
    initialize();
  }
} else if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('bandcamp.com')) {
  // In test environment with mocked window
  initialize();
}

// Check if current page is a Bandcamp page
function isBandcampPage() {
  try {
    const host = window && window.location && window.location.hostname;
    return typeof host === 'string' && host.includes('bandcamp.com');
  } catch (_) {
    return false;
  }
}

// Set up message listener for communication with background script
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.type);

    switch (message.type) {
      case 'PING':
        // Simple ping response to check if content script is loaded
        sendResponse({ success: true, message: 'Content script is ready' });
        return false; // Synchronous response

      case 'NAVIGATE_TO_PURCHASES':
        handleNavigateToPurchases(sendResponse);
        return true;

      case 'SCRAPE_PURCHASES':
        handleScrapePurchases(sendResponse);
        return true; // Keep channel open for async response

      case 'CHECK_DOWNLOAD_READY':
        handleCheckDownloadReady(sendResponse);
        return true;

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

      case 'MONITOR_DOWNLOAD_PAGE':
        handleMonitorDownloadPage(sendResponse);
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

    // Method 1: Look for the Collection button/link in the header
    // Try multiple selectors for the Collection button
    const collectionSelectors = [
      'a[href*="?from=menubar"]',
      '.menubar a[href*="bandcamp.com/"][href*="?"]',
      'a[href$="?from=menubar"]'
    ];

    let collectionButton = null;
    for (const selector of collectionSelectors) {
      try {
        collectionButton = document.querySelector(selector);
        if (!collectionButton) {
          // Try finding by text content
          const allLinks = document.querySelectorAll('a');
          collectionButton = Array.from(allLinks).find(link =>
            link.textContent.trim().toLowerCase() === 'collection' && link.href.includes('bandcamp.com')
          );
        }
        if (collectionButton) break;
      } catch (e) {
        // Some selectors might not be valid, continue trying
      }
    }

    console.log('Collection button found:', collectionButton?.href);

    if (collectionButton && collectionButton.href) {
      // Extract username from URL like: https://bandcamp.com/carlxt?from=menubar
      const match = collectionButton.href.match(/bandcamp\.com\/([^\/\?]+)/);
      if (match && match[1]) {
        username = match[1];
        console.log('Found username from Collection button:', username);
      }
    }

    // Method 1b: Try other header links if Collection button not found
    if (!username) {
      const headerLinks = document.querySelectorAll('.menubar a[href*="bandcamp.com/"], .user-nav a[href*="bandcamp.com/"]');
      console.log('Header links:', Array.from(headerLinks).map(l => ({ href: l.href, text: l.textContent.trim() })));

      for (const link of headerLinks) {
        // Look for links like bandcamp.com/carlxt
        const match = link.href.match(/bandcamp\.com\/([^\/\?]+)(?:[\?\/]|$)/);
        if (match && match[1] && !['login', 'signup', 'help', 'discover', 'feed'].includes(match[1])) {
          username = match[1];
          console.log('Found username from header link:', username);
          break;
        }
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
    console.log('Attempting to navigate to purchases page...');

    // Check if we're already on the purchases page
    const pathname = (window && window.location && typeof window.location.pathname === 'string') ? window.location.pathname : '';
    if (pathname.includes('/purchases')) {
      sendResponse({ success: true, message: 'Already on purchases page', purchasesUrl: window.location.href });
      return;
    }

    // Resolve username via dedicated resolver
    const username = findUsernameOnPage();

    if (username) {
      const purchasesUrl = `https://bandcamp.com/${username}/purchases`;
      console.log('Constructed purchases URL from username:', username, purchasesUrl);
      sendResponse({ success: true, purchasesUrl });
      return;
    }

    // Last resort: Try to find any purchases link on the page
    const directPurchasesLink = document.querySelector('a[href*="/purchases"]');
    if (directPurchasesLink) {
      console.log('Found direct purchases link:', directPurchasesLink.href);
      sendResponse({ success: true, purchasesUrl: directPurchasesLink.href });
      return;
    }

    // If all else fails, return error
    sendResponse({ error: 'Could not determine username to construct purchases URL. Please navigate to your purchases page manually.' });

  } catch (error) {
    console.error('Error navigating to purchases:', error);
    sendResponse({ error: error.message });
  }
}

// Expose for testing only
try {
  if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    window.__handleNavigateToPurchases = handleNavigateToPurchases;
  }
} catch (_) {}
// Scrape purchases page (Refactored: DOM-only with known selectors)
async function handleScrapePurchases(sendResponse) {
  try {
    console.log('Scraping purchases page (DOM-only refactor)...');

    // Must be on purchases page
    const isPurchasesPage = window.location.pathname.includes('/purchases');
    if (!isPurchasesPage) {
      sendResponse({ error: 'Not on purchases page' });
      return;
    }

    // DOM mode: scrape visible, downloadable-only items using canonical selectors
    const listEl = document.querySelector('#oh-container > div.purchases > ol') ||
                   document.querySelector('#oh-container div.purchases > ol');
    if (!listEl) {
      console.error('Purchases list not found via canonical selectors');
      sendResponse({ error: 'Purchases list not found' });
      return;
    }

    const itemNodes = Array.from(listEl.children).filter(n => n && n.tagName === 'DIV');
    if (!itemNodes || itemNodes.length === 0) {
      console.error('Purchases items not found (no direct div children)');
      sendResponse({ error: 'No purchases found in list' });
      return;
    }

    const toAbsolute = (href) => {
      try { return new URL(href, window.location.origin).href; } catch (_) { return href; }
    };

    const purchases = [];
    for (const el of itemNodes) {
      try {
        const a = el.querySelector('a[data-tid="download"]');
        if (!a || !a.getAttribute('href')) continue; // downloadable-only
        const downloadUrl = toAbsolute(a.getAttribute('href'));
        purchases.push({
          title: '',
          artist: '',
          url: '',
          artworkUrl: '',
          purchaseDate: '',
          itemType: '',
          downloadUrl
        });
      } catch (_) {}
    }

    if (purchases.length === 0) {
      console.error('No downloadable items found in DOM mode');
      sendResponse({ error: 'No downloadable purchases found' });
      return;
    }

    sendResponse({ success: true, purchases, totalCount: purchases.length });

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
      '.ownership',
      '.download-link-container'
    ];

    let isOwned = false;
    for (const selector of ownedIndicators) {
      const element = document.querySelector(selector);
      if (element) { isOwned = true; break; }
    }
    if (!isOwned) {
      // Fallback by scanning text content for ownership
      const elements = Array.from(document.querySelectorAll('body *'));
      isOwned = elements.some(el => (el.textContent || '').toLowerCase().includes('you own this'));
    }

    if (downloadLink) {
      try {
        // Normalize URL using utilities if available
        const utils = (typeof window !== 'undefined' && window.TrailMixUtils) || {};
        const decode = (utils.StringUtils && utils.StringUtils.decodeHtml) ? utils.StringUtils.decodeHtml : (s => s);
        const toAbs = (utils.UrlUtils && utils.UrlUtils.toAbsolute) ? utils.UrlUtils.toAbsolute : (s => s);
        downloadLink = toAbs(decode(downloadLink));
      } catch (_) {}
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

// Check if download link is ready on download page
async function handleCheckDownloadReady(sendResponse) {
  try {
    console.log('Checking if download link is ready...');

    // Extract artist and title from the download page
    const artistElement = document.querySelector('.artist, .download-artist, .albumTitle span');
    const titleElement = document.querySelector('.title, .download-title, .trackTitle');

    const artist = DOMUtils.getTextContent(artistElement) || null;
    const title = DOMUtils.getTextContent(titleElement) || null;

    console.log('Extracted metadata from download page:', { artist, title });

    // Check for the download link anchor element
    // Based on the HTML structure: <a href="https://p4.bcbits.com/download/..." ...>Download</a>
    const downloadLink = document.querySelector('a[href*="bcbits.com/download"]');

    if (downloadLink && downloadLink.href && downloadLink.style.display !== 'none') {
      // Download link is ready
      console.log('Download link found:', downloadLink.href);
      sendResponse({
        ready: true,
        url: downloadLink.href,
        metadata: {
          artist: artist,
          title: title
        }
      });
    } else {
      // Check if we're still in preparing state
      const preparingDiv = document.querySelector('.preparing-wrapper');
      const isPrep= preparingDiv && preparingDiv.style.display !== 'none';

      if (isPrep) {
        console.log('Still preparing download...');
        sendResponse({
          ready: false,
          preparing: true
        });
      } else {
        // Look for any visible download link with different selectors
        const alternativeSelectors = [
          'a[data-bind*="downloadUrl"]',
          '.download-format-tmp a[href*="download"]',
          'a[href*="p4.bcbits.com"]'
        ];

        let foundLink = null;
        for (const selector of alternativeSelectors) {
          const link = document.querySelector(selector);
          if (link && link.href && !link.style.display?.includes('none')) {
            foundLink = link.href;
            break;
          }
        }

        if (foundLink) {
          console.log('Alternative download link found:', foundLink);
          sendResponse({
            ready: true,
            url: foundLink,
            metadata: {
              artist: artist,
              title: title
            }
          });
        } else {
          console.log('Download link not ready yet');
          sendResponse({
            ready: false
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking download readiness:', error);
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

// Monitor download page for state changes
async function handleMonitorDownloadPage(sendResponse) {
  try {
    console.log('Monitoring download page state...');

    // Check if we're on a download page
    if (!window.location.pathname.includes('/download/')) {
      sendResponse({ error: 'Not on download page' });
      return;
    }

    // Look for "Preparing" message (scan text, avoid :contains)
    let preparingElement = document.querySelector('.preparing-download');
    if (!preparingElement) {
      const candidates = Array.from(document.querySelectorAll('.download-message, h2, p'));
      const match = candidates.find(el => (el.textContent || '').toLowerCase().includes('preparing'));
      if (match) preparingElement = match;
    }
    const downloadButton = document.querySelector('a[href*=".zip"], a.download-btn, button.download');

    if (preparingElement) {
      console.log('Download is still preparing...');

      // Wait for download button to appear
      const observer = new MutationObserver((mutations, obs) => {
        const downloadBtn = document.querySelector('a[href*=".zip"], a.download-btn, button.download');
        if (downloadBtn) {
          console.log('Download ready, button found:', downloadBtn.href || downloadBtn.textContent);
          obs.disconnect();

          // Auto-click the download button
          if (downloadBtn.href) {
            window.location.href = downloadBtn.href;
          } else {
            downloadBtn.click();
          }

          sendResponse({
            success: true,
            status: 'download_started',
            downloadUrl: downloadBtn.href || null
          });
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Set timeout for observer
      setTimeout(() => {
        observer.disconnect();
        sendResponse({
          success: false,
          status: 'timeout',
          error: 'Download preparation timed out'
        });
      }, 30000); // 30 second timeout

    } else if (downloadButton) {
      console.log('Download button already available');

      // Auto-click the download button
      if (downloadButton.href) {
        window.location.href = downloadButton.href;
      } else {
        downloadButton.click();
      }

      sendResponse({
        success: true,
        status: 'download_started',
        downloadUrl: downloadButton.href || null
      });

    } else {
      sendResponse({
        success: false,
        status: 'unknown',
        error: 'Could not determine download page state'
      });
    }

  } catch (error) {
    console.error('Error monitoring download page:', error);
    sendResponse({ error: error.message });
  }
}

console.log('Trail Mix content script fully initialized');
