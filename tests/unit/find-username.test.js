/**
 * Unit tests for findUsernameOnPage (content script)
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

describe('findUsernameOnPage', () => {
  let originalSelf;
  beforeEach(() => { originalSelf = global.self; });
  afterEach(() => { global.self = originalSelf; });

  test('extracts from bandcamp.com root path (/username)', () => {
    setupDom('https://bandcamp.com/carlxt');
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('carlxt');
  });

  test('extracts from bandcamp.com path with collection', () => {
    setupDom('https://bandcamp.com/carlxt/collection');
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('carlxt');
  });

  test('does not return reserved path names (login)', () => {
    setupDom('https://bandcamp.com/login');
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe(null);
  });

  test('extracts from meta og:url', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:url" content="https://bandcamp.com/userone">
        </head>
        <body></body>
      </html>`;
    setupDom('https://bandcamp.com/', html);
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('userone');
  });

  test('extracts from collection menubar link (?from=menubar)', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <a href="https://bandcamp.com/user2?from=menubar">Profile</a>
      </body></html>`;
    setupDom('https://x.bandcamp.com/album/y', html);
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('user2');
  });

  test('extracts from text link labeled Collection to bandcamp.com', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <a href="https://bandcamp.com/user3">Collection</a>
      </body></html>`;
    setupDom('https://x.bandcamp.com/track/z', html);
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('user3');
  });

  test('extracts from menubar header links', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div class="menubar">
          <a href="https://bandcamp.com/user4/something">User Link</a>
        </div>
      </body></html>`;
    setupDom('https://bandcamp.com', html);
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('user4');
  });

  test('extracts via fallback selector with ?from= query', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <a href="https://bandcamp.com/user5?from=footer">Footer Profile</a>
      </body></html>`;
    setupDom('https://bandcamp.com', html);
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe('user5');
  });

  test('ignores reserved targets in links (login)', () => {
    const html = `
      <!DOCTYPE html>
      <html><body>
        <div class="menubar">
          <a href="https://bandcamp.com/login">Login</a>
        </div>
      </body></html>`;
    setupDom('https://bandcamp.com', html);
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe(null);
  });

  test('returns null when no username can be determined', () => {
    setupDom('https://example.com/');
    loadContentScript();
    expect(window.findUsernameOnPage()).toBe(null);
  });
});
