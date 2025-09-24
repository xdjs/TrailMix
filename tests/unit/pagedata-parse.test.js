/**
 * Fixture-based test for pagedata parsing in content script (SCRAPE_PURCHASES)
 */

const { JSDOM } = require('jsdom');

describe('Content Script: SCRAPE_PURCHASES pagedata parsing', () => {
  let dom;
  let document;
  let window;
  let messageHandler;

  beforeEach(() => {
    // Basic purchases page with #pagedata
    const pageData = {
      orderhistory: {
        items: [
          {
            item_title: 'Track A',
            artist_name: 'Artist X',
            item_url: 'https://x.bandcamp.com/track/a',
            art_id: 12345,
            payment_date: '01 Jan 2025 00:00:00 GMT',
            download_type: 't',
            download_url: 'https://bandcamp.com/download?from=order_history&payment_id=1&sitem_id=1'
          },
          {
            item_title: 'Album B',
            artist_name: 'Artist Y',
            item_url: 'https://y.bandcamp.com/album/b',
            art_id: 67890,
            payment_date: '02 Jan 2025 00:00:00 GMT',
            download_type: 'a',
            download_url: null // non-downloadable item should be filtered out
          }
        ]
      }
    };

    const html = `<!DOCTYPE html>
      <html>
        <body>
          <div id="pagedata" data-blob='${JSON.stringify(pageData)}'></div>
        </body>
      </html>`;

    dom = new JSDOM(html, { url: 'https://bandcamp.com/testuser/purchases' });
    window = dom.window;
    document = window.document;

    global.window = window;
    global.document = document;

    // Provide minimal TrailMixUtils used by content script (not strictly required here)
    global.TrailMixUtils = {
      StringUtils: {
        decodeHtml: (s) => s
      },
      UrlUtils: {
        toAbsolute: (href) => href
      }
    };

    // Mock chrome APIs for content script registration
    global.chrome = global.chrome || {};
    chrome.runtime = chrome.runtime || {};
    chrome.runtime.onMessage = chrome.runtime.onMessage || { addListener: jest.fn() };

    // Load content script fresh
    jest.resetModules();
    delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
    require('../../content/bandcamp-scraper.js');

    const calls = chrome.runtime.onMessage.addListener.mock.calls;
    messageHandler = calls[0][0];
  });

  afterEach(() => {
    if (dom) dom.window.close();
  });

  test('returns only downloadable purchases with normalized URLs', async () => {
    const sendResponse = jest.fn();
    const keepAlive = messageHandler({ type: 'SCRAPE_PURCHASES' }, { tab: { id: 1 } }, sendResponse);
    expect(keepAlive).toBe(true);

    // Wait for asynchronous sendResponse to be called
    for (let i = 0; i < 10 && sendResponse.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 0));
    }

    // Validate response shape
    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(Array.isArray(resp.purchases)).toBe(true);
    expect(resp.purchases.length).toBe(1); // filters out null download_url
    expect(resp.purchases[0].title).toBe('Track A');
    expect(resp.purchases[0].downloadUrl).toMatch(/^https:\/\/bandcamp\.com\/download\?/);
  });
});
