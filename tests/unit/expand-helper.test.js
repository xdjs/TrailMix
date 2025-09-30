const { JSDOM } = require('jsdom');

// Mock Chrome APIs minimal for script load
const chromeMock = require('../mocks/chrome-mock');
global.chrome = chromeMock;

describe('Task 3.6 View-All Expansion Helper (unit)', () => {
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

  function mount(html, url = 'https://bandcamp.com/user/purchases') {
    dom = new JSDOM(html, { url });
    global.window = dom.window;
    global.document = dom.window.document;
    jest.resetModules();
    delete require.cache[require.resolve('../../content/bandcamp-scraper.js')];
    require('../../content/bandcamp-scraper.js');
    return dom.window;
  }

  test('parses expectedTotal from summary (digits-only)', () => {
    const html = `<!DOCTYPE html><html><body>
      <div id="oh-container">
        <div></div>
        <div><span>showing <span class="page-items-number">20</span> of 27 purchases</span></div>
      </div>
    </body></html>`;
    const win = mount(html);
    const getM = win.__getExpectedTotalFromSummary;
    expect(typeof getM).toBe('function');
    expect(getM()).toBe(27);

    // Alternate text without page-items-number
    win.document.querySelector('#oh-container > div:nth-child(2) > span').innerHTML = 'showing 10 of 41 purchases';
    expect(getM()).toBe(41);
  });

  test('expands to reach expected total with growth', async () => {
    const makeItems = (n) => Array.from({ length: n }, () => '<div class="purchases-item"></div>').join('');
    const html = `<!DOCTYPE html><html><body>
      <div id="oh-container">
        <div></div>
        <div><span>showing <span class="page-items-number">20</span> of 27 purchases</span></div>
        <div class="purchases">
          <div><button>View all 27 purchases</button></div>
          <ol id="list">${makeItems(10)}</ol>
        </div>
      </div>
    </body></html>`;
    const win = mount(html);
    const doc = win.document;
    const listEl = doc.getElementById('list');
    const expand = win.__expandPurchasesIfNeeded;

    // Schedule growth to simulate lazy load
    setTimeout(() => {
      listEl.insertAdjacentHTML('beforeend', makeItems(7)); // 17
    }, 50);
    setTimeout(() => {
      listEl.insertAdjacentHTML('beforeend', makeItems(10)); // 27
    }, 100);

    await expand({ listEl, pollMs: 10, retryWindowMs: 50, overallTimeoutMs: 2000 });
    expect(listEl.children.length).toBe(27);
  });

  test('times out when growth does not reach expected', async () => {
    const makeItems = (n) => Array.from({ length: n }, () => '<div class="purchases-item"></div>').join('');
    const html = `<!DOCTYPE html><html><body>
      <div id="oh-container">
        <div></div>
        <div><span>showing <span class="page-items-number">20</span> of 30 purchases</span></div>
        <div class="purchases">
          <div><button>View all 30 purchases</button></div>
          <ol id="list">${makeItems(10)}</ol>
        </div>
      </div>
    </body></html>`;
    const win = mount(html);
    const doc = win.document;
    const listEl = doc.getElementById('list');
    const expand = win.__expandPurchasesIfNeeded;

    await expand({ listEl, pollMs: 10, retryWindowMs: 50, overallTimeoutMs: 300 });
    expect(listEl.children.length).toBe(10);
  });

  test('no-op when no button or visible already >= expected', async () => {
    const makeItems = (n) => Array.from({ length: n }, () => '<div class="purchases-item"></div>').join('');
    const html = `<!DOCTYPE html><html><body>
      <div id="oh-container">
        <div></div>
        <div><span>showing <span class="page-items-number">10</span> of 10 purchases</span></div>
        <div class="purchases">
          <ol id="list">${makeItems(10)}</ol>
        </div>
      </div>
    </body></html>`;
    const win = mount(html);
    const doc = win.document;
    const listEl = doc.getElementById('list');
    const expand = win.__expandPurchasesIfNeeded;
    await expand({ listEl, pollMs: 10, overallTimeoutMs: 300 });
    expect(listEl.children.length).toBe(10);
  });
});

