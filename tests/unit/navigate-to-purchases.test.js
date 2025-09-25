/**
 * Unit tests for handleNavigateToPurchases via message handler
 */

const { JSDOM } = require('jsdom');

function loadContentScript() {
  jest.resetModules();
  delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
  try {
    Object.defineProperty(global.document, 'readyState', {
      value: 'complete',
      configurable: true
    });
  } catch (_) {}
  require('../../content/bandcamp-scraper.js');
}

function setupDom(url, html = '<!DOCTYPE html><html><head></head><body></body></html>') {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  return dom;
}

// We will call the exposed testing hook instead of relying on message bus

describe('handleNavigateToPurchases', () => {
  let originalSelf;
  beforeEach(() => { originalSelf = global.self; });
  afterEach(() => { global.self = originalSelf; });

  test('returns current URL when already on purchases page', async () => {
    setupDom('https://bandcamp.com/testuser/purchases');
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.purchasesUrl).toBe('https://bandcamp.com/testuser/purchases');
  });

  test('constructs purchases URL from root path username', async () => {
    setupDom('https://bandcamp.com/carlxt/collection');
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.purchasesUrl).toBe('https://bandcamp.com/carlxt/purchases');
  });

  test('constructs purchases URL from og:url meta', async () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:url" content="https://bandcamp.com/userone" />
    </head><body></body></html>`;
    setupDom('https://bandcamp.com/', html);
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.purchasesUrl).toBe('https://bandcamp.com/userone/purchases');
  });

  test('constructs from Collection menubar link (?from=menubar)', async () => {
    const html = `<!DOCTYPE html><html><body>
      <a href="https://bandcamp.com/user2?from=menubar">Collection</a>
    </body></html>`;
    setupDom('https://bandcamp.com', html);
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.purchasesUrl).toBe('https://bandcamp.com/user2/purchases');
  });

  test('constructs from menubar header link', async () => {
    const html = `<!DOCTYPE html><html><body>
      <div class="menubar">
        <a href="https://bandcamp.com/user4/something">User</a>
      </div>
    </body></html>`;
    setupDom('https://bandcamp.com', html);
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.purchasesUrl).toBe('https://bandcamp.com/user4/purchases');
  });

  test('falls back to direct purchases link when username not found', async () => {
    const html = `<!DOCTYPE html><html><body>
      <a href="https://bandcamp.com/anyuser/purchases">Purchases</a>
    </body></html>`;
    setupDom('https://bandcamp.com', html);
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.success).toBe(true);
    expect(resp.purchasesUrl).toBe('https://bandcamp.com/anyuser/purchases');
  });

  test('returns error when neither username nor purchases link are found', async () => {
    setupDom('https://bandcamp.com/');
    loadContentScript();
    const sendResponse = jest.fn();
    await window.__handleNavigateToPurchases(sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.error).toMatch(/Could not determine username/i);
  });
});
