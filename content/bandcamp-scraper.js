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
      'a[href*="?from=menubar"]',  // Link with from=menubar parameter
      'a.menubar-item:has-text("Collection")',  // Link containing "Collection" text
      'a:contains("Collection")',
      '.menubar a[href*="bandcamp.com/"][href*="?"]',  // Menubar links with parameters
      'a[href$="?from=menubar"]'  // Links ending with from=menubar
    ];

    let collectionButton = null;
    for (const selector of collectionSelectors) {
      try {
        collectionButton = document.querySelector(selector);
        if (!collectionButton) {
          // Try finding by text content
          const allLinks = document.querySelectorAll('a');
          collectionButton = Array.from(allLinks).find(link =>
            link.textContent.trim() === 'Collection' && link.href.includes('bandcamp.com')
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
    if (window.location.pathname.includes('/purchases')) {
      sendResponse({ success: true, message: 'Already on purchases page', purchasesUrl: window.location.href });
      return;
    }

    // Extract username from the Collection button (we know this works)
    console.log('Extracting username from Collection button...');

    const collectionButton = document.querySelector('a[href*="?from=menubar"]') ||
                            Array.from(document.querySelectorAll('a')).find(link =>
                              link.textContent.trim() === 'Collection' && link.href.includes('bandcamp.com')
                            );

    if (collectionButton && collectionButton.href) {
      // Extract username from URL like: https://bandcamp.com/carlxt?from=menubar
      const match = collectionButton.href.match(/bandcamp\.com\/([^\/\?]+)/);
      if (match && match[1]) {
        const username = match[1];
        const purchasesUrl = `https://bandcamp.com/${username}/purchases`;

        console.log('Found username:', username);
        console.log('Constructed purchases URL:', purchasesUrl);

        sendResponse({ success: true, purchasesUrl: purchasesUrl });
        return;
      }
    }

    // Fallback: Try to get username from other sources
    console.log('Collection button not found, trying other methods...');

    // Check if we're logged in and can find username elsewhere
    const usernameSelectors = [
      'a[href*="bandcamp.com/"][href*="?from="]', // Links with from parameter
      '.menubar a[href^="https://bandcamp.com/"]', // Direct profile links
    ];

    for (const selector of usernameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.href) {
        const match = element.href.match(/bandcamp\.com\/([^\/\?]+)/);
        if (match && match[1] && !['login', 'signup', 'help', 'discover'].includes(match[1])) {
          const username = match[1];
          const purchasesUrl = `https://bandcamp.com/${username}/purchases`;

          console.log('Found username from fallback:', username);
          console.log('Constructed purchases URL:', purchasesUrl);

          sendResponse({ success: true, purchasesUrl: purchasesUrl });
          return;
        }
      }
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

// Scrape purchases page
async function handleScrapePurchases(sendResponse) {
  try {
    console.log('Scraping purchases page...');

    // Check if we're on a purchases page
    const isPurchasesPage = window.location.pathname.includes('/purchases');
    const isCollectionPage = window.location.hostname === 'bandcamp.com' &&
                            (window.location.pathname.match(/^\/[^\/]+\/?$/) ||
                             window.location.pathname.includes('/collection'));

    if (!isPurchasesPage && !isCollectionPage) {
      sendResponse({ error: 'Not on purchases or collection page' });
      return;
    }

    // Try to extract data from pagedata blob first (purchases page)
    if (isPurchasesPage) {
      const pageDataElement = document.getElementById('pagedata');
      if (pageDataElement) {
        try {
          const pageData = JSON.parse(pageDataElement.getAttribute('data-blob'));
          if (pageData && pageData.orderhistory && pageData.orderhistory.items) {
            const purchases = [];

            for (const item of pageData.orderhistory.items) {
              // Skip items without download URLs (subscriptions, etc.)
              if (!item.download_url) continue;

              purchases.push({
                title: item.item_title || 'Unknown Title',
                artist: item.artist_name || item.seller_name || 'Unknown Artist',
                url: item.item_url || '',
                artworkUrl: item.art_id ? `https://f4.bcbits.com/img/a${item.art_id}_2.jpg` : '',
                purchaseDate: item.payment_date || '',
                itemType: item.download_type === 't' ? 'track' : 'album',
                downloadUrl: item.download_url.replace(/&amp;/g, '&') // Decode HTML entities
              });
            }

            console.log(`Successfully scraped ${purchases.length} purchases from pagedata`);

            sendResponse({
              success: true,
              purchases,
              totalCount: purchases.length
            });
            return;
          }
        } catch (err) {
          console.error('Error parsing pagedata:', err);
          // Fall through to DOM scraping
        }
      }
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

        // Extract download link if available (only on purchases page)
        let downloadUrl = null;
        if (isPurchasesPage) {
          // Look for download links within the item container
          const downloadLink = element.querySelector('a[href*="/download/album"], a[href*="/download/track"], a.download-link, .download-col a');
          if (downloadLink) {
            downloadUrl = downloadLink.href;
            console.log(`Found download link for ${title}: ${downloadUrl}`);
          }
        }

        if (title && url) {
          purchases.push({
            title,
            artist: artist || 'Unknown Artist',
            url,
            artworkUrl,
            purchaseDate: purchaseDate || '',
            itemType,
            downloadUrl  // Include download URL if found
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

// Monitor download page for state changes
async function handleMonitorDownloadPage(sendResponse) {
  try {
    console.log('Monitoring download page state...');

    // Check if we're on a download page
    if (!window.location.pathname.includes('/download/')) {
      sendResponse({ error: 'Not on download page' });
      return;
    }

    // Look for "Preparing" message
    const preparingElement = document.querySelector('.preparing-download, .download-message:contains("Preparing"), h2:contains("Preparing")');
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

