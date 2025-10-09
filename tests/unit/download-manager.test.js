/**
 * Unit tests for Download Manager
 * Tests Phase 4 Task 4.1: Core Download Engine
 */

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    create: jest.fn(),
    remove: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  downloads: {
    download: jest.fn(),
    cancel: jest.fn(() => Promise.resolve()),
    onChanged: {
      addListener: jest.fn()
    }
  },
  runtime: {
    lastError: null
  }
};

// Set up global chrome mock
global.chrome = mockChrome;

// Import after setting up mocks
const DownloadManager = require('../../lib/download-manager.js');

describe('DownloadManager', () => {
  let downloadManager;
  let mockPurchaseItem;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create new instance
    downloadManager = new DownloadManager();

    // Create mock purchase item
    mockPurchaseItem = {
      title: 'Test Album',
      artist: 'Test Artist',
      downloadUrl: 'https://bandcamp.com/download/album?id=123456',
      albumArt: 'https://example.com/artwork.jpg'
    };
  });

  describe('Single Download Functionality', () => {
    test('should create DownloadManager instance', () => {
      expect(downloadManager).toBeDefined();
      expect(downloadManager.activeDownload).toBeNull();
      expect(downloadManager.downloadProgress).toEqual({});
    });

    test('should open download page in inactive tab', async () => {
      const mockTabId = 123;
      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });

      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Should create tab with download URL
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: mockPurchaseItem.downloadUrl,
        active: false
      });

      // Cleanup
      downloadManager.cancel();
      await expect(downloadPromise).rejects.toThrow('Download cancelled');
    });

    test('should monitor tab for download link readiness', async () => {
      const mockTabId = 123;
      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });

      // Mock sendMessage to never be ready
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: false });
        }
      });

      // Start download (don't await - we're testing the monitoring state)
      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Allow promise to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should set up monitoring for the tab
      expect(downloadManager.activeDownload).toBeTruthy();
      expect(downloadManager.activeDownload.tabId).toBe(mockTabId);
      expect(downloadManager.activeDownload.status).toBe('preparing');

      // Cleanup - cancel and catch the rejection
      downloadManager.cancel();
      await expect(downloadPromise).rejects.toThrow('Download cancelled');
    });

    test('should extract download link when ready', async () => {
      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      // Simulate content script response with download link ready
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          setTimeout(() => callback({ ready: true, url: mockDownloadUrl }), 0);
        }
      });

      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Wait for monitoring to start and check to happen
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should have sent message to check if download is ready
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTabId,
        { type: 'CHECK_DOWNLOAD_READY' },
        expect.any(Function)
      );

      // Cleanup
      downloadManager.cancel();
      await expect(downloadPromise).rejects.toThrow('Download cancelled');
    });

    test('should initiate download using Chrome Downloads API', async () => {
      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      // Simulate content script response with download link ready immediately
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          // Return ready immediately
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Wait for monitoring cycle to complete
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should have initiated download
      expect(mockChrome.downloads.download).toHaveBeenCalledWith({
        url: mockDownloadUrl,
        saveAs: false
      });

      // Should track the download ID
      expect(downloadManager.activeDownload.downloadId).toBe(mockDownloadId);

      // Cleanup
      downloadManager.cancel();
      await expect(downloadPromise).rejects.toThrow('Download cancelled');
    });

    test('should close tab after initiating download', async () => {
      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      // Simulate content script response with download link ready
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Wait for monitoring and download initiation to complete
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Should have closed the tab
      expect(mockChrome.tabs.remove).toHaveBeenCalledWith(mockTabId);

      // Cleanup
      downloadManager.cancel();
      await expect(downloadPromise).rejects.toThrow('Download cancelled');
    });

    test('should track download progress', async () => {
      const mockDownloadId = 456;
      const progressCallback = jest.fn();

      // Set up progress listener
      downloadManager.onProgress = progressCallback;

      // Simulate progress update
      const progressDelta = {
        id: mockDownloadId,
        state: { current: 'in_progress' },
        bytesReceived: { current: 5000000 },
        totalBytes: { current: 10000000 }
      };

      // Get the listener that was registered
      const onChangedListener = mockChrome.downloads.onChanged.addListener.mock.calls[0]?.[0];

      if (onChangedListener) {
        // Simulate download with active download
        downloadManager.activeDownload = {
          downloadId: mockDownloadId,
          totalBytes: 10000000
        };

        onChangedListener(progressDelta);

        // Should have called progress callback
        expect(progressCallback).toHaveBeenCalledWith({
          downloadId: mockDownloadId,
          bytesReceived: 5000000,
          totalBytes: 10000000,
          percentComplete: 50
        });
      }
    });

    test('should handle download completion', async () => {
      const mockDownloadId = 456;

      // Mock downloads.search for manifest recording
      mockChrome.downloads.search = jest.fn().mockResolvedValue([]);

      // Get the listener that was registered
      const onChangedListener = mockChrome.downloads.onChanged.addListener.mock.calls[0]?.[0];

      if (onChangedListener) {
        // Simulate download with active download
        const mockResolve = jest.fn();
        const mockReject = jest.fn();

        downloadManager.activeDownload = {
          downloadId: mockDownloadId,
          purchaseItem: mockPurchaseItem,
          metadata: {
            artist: 'Test Artist',
            title: 'Test Album'
          },
          promise: {
            resolve: mockResolve,
            reject: mockReject
          }
        };

        // Simulate completion
        const completeDelta = {
          id: mockDownloadId,
          state: { current: 'complete' }
        };

        onChangedListener(completeDelta);

        // Wait for async operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should resolve the promise
        expect(mockResolve).toHaveBeenCalled();

        // Should clear active download
        expect(downloadManager.activeDownload).toBeNull();
      }
    });

    test('should handle download errors', async () => {
      const mockTabId = 123;

      mockChrome.tabs.create.mockRejectedValue(new Error('Tab creation failed'));

      // Should reject the promise
      await expect(downloadManager.download(mockPurchaseItem)).rejects.toThrow('Tab creation failed');

      // Should clear active download
      expect(downloadManager.activeDownload).toBeNull();
    });

    test('should timeout if download link never appears', async () => {
      jest.useFakeTimers();

      const mockTabId = 123;
      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });

      // Simulate content script always returning "not ready"
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: false });
        }
      });

      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Fast-forward through all checks (15 checks * 2000ms = 30000ms)
      for (let i = 0; i < 16; i++) {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      }

      // Should reject with timeout error
      await expect(downloadPromise).rejects.toThrow('Download preparation timeout');

      jest.useRealTimers();
    }, 15000); // Increase test timeout
  });

  describe('Acceptance Criteria', () => {
    test('AC4.1.1: Successfully downloads a single purchase item', async () => {
      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      // Start download
      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Wait for full download cycle
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate download completion
      downloadManager.handleDownloadChange({
        id: mockDownloadId,
        state: { current: 'complete' }
      });

      // Wait for promise to resolve
      const result = await downloadPromise;
      expect(result.success).toBe(true);

      // Verify complete flow
      expect(mockChrome.tabs.create).toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
      expect(mockChrome.downloads.download).toHaveBeenCalled();
      expect(mockChrome.tabs.remove).toHaveBeenCalled();
    }, 15000);
  });

  describe('Manifest Recording', () => {
    let mockManifestManager;

    beforeEach(() => {
      // Mock manifest manager
      mockManifestManager = {
        appendEntry: jest.fn().mockResolvedValue(undefined)
      };
      global.manifestManager = mockManifestManager;

      // Mock downloads.search for getting final file path
      mockChrome.downloads.search = jest.fn();
    });

    afterEach(() => {
      delete global.manifestManager;
    });

    test('should record download in manifest on completion', async () => {
      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      // Mock getting the final file path
      mockChrome.downloads.search.mockResolvedValue([
        {
          id: mockDownloadId,
          filename: '/Users/test/Downloads/TrailMix/Test Artist/Test Album/track.zip'
        }
      ]);

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      // Start download
      const downloadPromise = downloadManager.download(mockPurchaseItem);

      // Wait for full download cycle
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate download completion
      downloadManager.handleDownloadChange({
        id: mockDownloadId,
        state: { current: 'complete' }
      });

      // Wait for promise to resolve
      await downloadPromise;

      // Verify manifest entry was created
      expect(mockManifestManager.appendEntry).toHaveBeenCalledWith(
        'Test Artist',
        'Test Album',
        expect.any(String), // timestamp
        'TrailMix/Test Artist/Test Album/track.zip', // relative path
        expect.any(Number) // downloadId
      );
    }, 15000);

    test('should extract relative path correctly', async () => {
      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      // Mock getting the final file path with full absolute path
      mockChrome.downloads.search.mockResolvedValue([
        {
          id: mockDownloadId,
          filename: '/Users/someone/Downloads/TrailMix/Artist/Album/file.zip'
        }
      ]);

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      // Start download
      const downloadPromise = downloadManager.download(mockPurchaseItem);

      await new Promise(resolve => setTimeout(resolve, 3000));

      downloadManager.handleDownloadChange({
        id: mockDownloadId,
        state: { current: 'complete' }
      });

      await downloadPromise;

      // Verify relative path extraction
      const callArgs = mockManifestManager.appendEntry.mock.calls[0];
      expect(callArgs[3]).toBe('TrailMix/Artist/Album/file.zip');
    }, 15000);

    test('should handle missing manifest manager gracefully', async () => {
      delete global.manifestManager;

      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      mockChrome.downloads.search.mockResolvedValue([
        {
          id: mockDownloadId,
          filename: '/Users/test/Downloads/TrailMix/Test Artist/Test Album/track.zip'
        }
      ]);

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      // Start download - should not throw even without manifest manager
      const downloadPromise = downloadManager.download(mockPurchaseItem);

      await new Promise(resolve => setTimeout(resolve, 3000));

      downloadManager.handleDownloadChange({
        id: mockDownloadId,
        state: { current: 'complete' }
      });

      // Should complete successfully
      await expect(downloadPromise).resolves.toHaveProperty('success', true);
    }, 15000);

    test('should not crash if manifest recording fails', async () => {
      mockManifestManager.appendEntry.mockRejectedValue(new Error('Manifest write failed'));

      const mockTabId = 123;
      const mockDownloadUrl = 'https://p4.bcbits.com/download/track/abc123';
      const mockDownloadId = 456;

      mockChrome.tabs.create.mockResolvedValue({ id: mockTabId });
      mockChrome.downloads.download.mockResolvedValue(mockDownloadId);
      mockChrome.tabs.remove.mockResolvedValue();

      mockChrome.downloads.search.mockResolvedValue([
        {
          id: mockDownloadId,
          filename: '/Users/test/Downloads/TrailMix/Test Artist/Test Album/track.zip'
        }
      ]);

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'CHECK_DOWNLOAD_READY') {
          callback({ ready: true, url: mockDownloadUrl });
        }
      });

      // Start download
      const downloadPromise = downloadManager.download(mockPurchaseItem);

      await new Promise(resolve => setTimeout(resolve, 3000));

      downloadManager.handleDownloadChange({
        id: mockDownloadId,
        state: { current: 'complete' }
      });

      // Download should still complete successfully despite manifest error
      await expect(downloadPromise).resolves.toHaveProperty('success', true);
    }, 15000);
  });
});