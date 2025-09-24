/**
 * Integration test: DISCOVER_AND_START end-to-end behavior
 * - Mocks Chrome APIs for tabs, storage, and messaging
 * - Ensures background discovers purchases and spawns up to 3 tabs
 */

// Use the global chrome mock from tests/setup.js

describe('Integration: DISCOVER_AND_START', () => {
  let messageHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Minimal mocks for discovery path
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://bandcamp.com/testuser/purchases' }
    ]);
    chrome.tabs.update.mockResolvedValue({ id: 1, url: 'https://bandcamp.com/testuser/purchases' });

    // Content script calls during discovery/scrape
    chrome.tabs.sendMessage.mockImplementation(async (tabId, msg) => {
      if (msg && msg.type === 'SCRAPE_PURCHASES') {
        return {
          success: true,
          purchases: [
            { title: 'A', artist: 'X', url: 'https://x.bandcamp.com/track/a', downloadUrl: 'https://bandcamp.com/download?one' },
            { title: 'B', artist: 'Y', url: 'https://y.bandcamp.com/album/b', downloadUrl: 'https://bandcamp.com/download?two' },
            { title: 'C', artist: 'Z', url: 'https://z.bandcamp.com/album/c', downloadUrl: 'https://bandcamp.com/download?three' },
            { title: 'D', artist: 'Z', url: 'https://z.bandcamp.com/album/d', downloadUrl: 'https://bandcamp.com/download?four' }
          ],
          totalCount: 4,
          totals: { items: 4, downloadable: 4 }
        };
      }
      if (msg && msg.type === 'MONITOR_DOWNLOAD_PAGE') {
        return { success: true, status: 'monitoring' };
      }
      return {};
    });

    // 3 concurrent downloads by default
    chrome.storage.local.get.mockResolvedValue({ maxConcurrentDownloads: 3 });

    // Each tabs.create returns a different id
    let nextId = 1000;
    chrome.tabs.create.mockImplementation(async ({ url }) => ({ id: nextId++, url }));

    // Load background service worker fresh
    delete require.cache[require.resolve('../../background/service-worker.js')];
    require('../../background/service-worker.js');

    // Capture the background message handler
    const calls = chrome.runtime.onMessage.addListener.mock.calls;
    messageHandler = calls[0][0];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('starts downloads and spawns up to 3 tabs', async () => {
    const sendResponse = jest.fn();

    // Trigger DISCOVER_AND_START
    const keepAlive = messageHandler({ type: 'DISCOVER_AND_START' }, { tab: { id: 999 } }, sendResponse);
    expect(keepAlive).toBe(true);

    // Allow async handlers to run
    await Promise.resolve();

    // processNextDownload should start up to 3 tabs initially
    expect(chrome.tabs.create).toHaveBeenCalledTimes(3);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 'started', totalPurchases: 4 }));
  });
});

