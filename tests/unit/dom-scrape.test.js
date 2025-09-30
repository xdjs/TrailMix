/**
 * DOM-only purchases scraping tests for SCRAPE_PURCHASES
 */
const { JSDOM } = require('jsdom');

// Mock Chrome APIs
const chromeMock = require('../mocks/chrome-mock');
global.chrome = chromeMock;

describe('Content Script: DOM-only SCRAPE_PURCHASES', () => {
  let dom;
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
  });

  afterEach(() => {
    if (dom) dom.window.close();
    global.window = originalWindow;
    global.document = originalDocument;
    jest.resetModules();
  });

  function mountPurchasesDom(html) {
    dom = new JSDOM(html, { url: 'https://bandcamp.com/testuser/purchases' });
    global.window = dom.window;
    global.document = dom.window.document;
    jest.resetModules();
    chrome.runtime.onMessage.addListener.mockClear();
    delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
    require('../../content/bandcamp-scraper.js');
    const calls = chrome.runtime.onMessage.addListener.mock.calls;
    return calls.length ? calls[0][0] : null;
  }

  test('returns only downloadable items via a[data-tid="download"]', async () => {
    const html = `<!DOCTYPE html><html><body>
      <div id="oh-container">
        <div class="purchases">
          <ol>
            <div class="purchases-item" sale_item_id="1">
              <div><div class="col flex-column spread"><div class="purchases-item-actions">
                <a data-tid="download" href="/download?from=order_history&payment_id=1&sig=xyz&sitem_id=1">download track</a>
              </div></div></div>
            </div>
            <div class="purchases-item" sale_item_id="2">
              <!-- no download link -->
            </div>
          </ol>
        </div>
      </div>
    </body></html>`;

    const handler = mountPurchasesDom(html);
    expect(handler).toBeTruthy();

    const sendResponse = jest.fn();
    const keepAlive = handler({ type: 'SCRAPE_PURCHASES' }, { tab: { id: 1 } }, sendResponse);
    expect(keepAlive).toBe(true);

    for (let i = 0; i < 100 && sendResponse.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 1));
    }

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.totalCount).toBe(1);
    expect(resp.purchases[0].downloadUrl).toMatch(/^https:\/\/bandcamp\.com\/download\?/);
  });

  test('errors when list selector missing', async () => {
    const html = '<!DOCTYPE html><html><body><div id="oh-container"></div></body></html>';
    const handler = mountPurchasesDom(html);
    expect(handler).toBeTruthy();

    const sendResponse = jest.fn();
    handler({ type: 'SCRAPE_PURCHASES' }, { tab: { id: 1 } }, sendResponse);
    for (let i = 0; i < 100 && sendResponse.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 1));
    }
    const resp = sendResponse.mock.calls[0][0];
    expect(resp.error).toBeTruthy();
  });
});

