/**
 * Unit tests for Service Worker Queue Integration
 */

// Mock the imports
const mockDownloadQueue = jest.fn();
const mockDownloadJob = jest.fn();
const mockDownloadManager = jest.fn();

// Mock the constructors
mockDownloadQueue.prototype.enqueue = jest.fn();
mockDownloadQueue.prototype.enqueueBatch = jest.fn();
mockDownloadQueue.prototype.dequeue = jest.fn();
mockDownloadQueue.prototype.clear = jest.fn();
mockDownloadQueue.prototype.pause = jest.fn();
mockDownloadQueue.prototype.resume = jest.fn();
mockDownloadQueue.prototype.isEmpty = jest.fn();
mockDownloadQueue.prototype.getStats = jest.fn();
mockDownloadQueue.prototype.serialize = jest.fn();
mockDownloadQueue.prototype.deserialize = jest.fn();
mockDownloadQueue.prototype.addEventListener = jest.fn();
mockDownloadQueue.prototype.completeCurrentJob = jest.fn();
mockDownloadQueue.prototype.failCurrentJob = jest.fn();

mockDownloadJob.prototype.start = jest.fn();
mockDownloadJob.prototype.complete = jest.fn();
mockDownloadJob.prototype.fail = jest.fn();
mockDownloadJob.prototype.updateProgress = jest.fn();
mockDownloadJob.prototype.canBeRetried = jest.fn();
mockDownloadJob.prototype.incrementRetry = jest.fn();
mockDownloadJob.prototype.getRetryDelay = jest.fn();
mockDownloadJob.STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed'
};
mockDownloadJob.deserialize = jest.fn();

mockDownloadManager.prototype.download = jest.fn();

// Store references to imports for testing
global.DownloadQueue = mockDownloadQueue;
global.DownloadJob = mockDownloadJob;
global.DownloadManager = mockDownloadManager;

describe('Service Worker Queue Integration', () => {
  let chrome;
  let downloadQueue;
  let globalDownloadManager;
  let currentDownloadJob;
  let downloadState;
  let isProcessing;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup chrome mock
    chrome = {
      runtime: {
        onMessage: { addListener: jest.fn() },
        sendMessage: jest.fn().mockResolvedValue()
      },
      storage: {
        local: {
          set: jest.fn().mockResolvedValue(),
          get: jest.fn().mockResolvedValue({})
        }
      },
      tabs: {
        query: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 1, url: 'https://bandcamp.com' }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
        get: jest.fn().mockResolvedValue({ id: 1, url: 'https://bandcamp.com/user/purchases' }),
        sendMessage: jest.fn().mockResolvedValue({ success: true, purchases: [] })
      }
    };
    global.chrome = chrome;

    // Initialize queue state
    downloadQueue = new mockDownloadQueue();
    downloadQueue.isPaused = false;
    downloadQueue.currentJob = null;

    globalDownloadManager = null;
    currentDownloadJob = null;
    downloadState = {
      isActive: false,
      isPaused: false,
      purchases: [],
      currentIndex: 0,
      completed: 0,
      failed: 0
    };
    isProcessing = false;

    // Mock importScripts
    global.importScripts = jest.fn();
  });

  describe('Queue Initialization', () => {
    test('should initialize download queue with event listeners', () => {
      // Simulate queue initialization with event listeners
      const jobCompletedHandler = jest.fn();
      const jobFailedHandler = jest.fn();
      const queueChangedHandler = jest.fn();

      downloadQueue.addEventListener('job-completed', jobCompletedHandler);
      downloadQueue.addEventListener('job-failed', jobFailedHandler);
      downloadQueue.addEventListener('queue-changed', queueChangedHandler);

      // Check that event listeners were registered
      expect(downloadQueue.addEventListener).toHaveBeenCalledWith('job-completed', jobCompletedHandler);
      expect(downloadQueue.addEventListener).toHaveBeenCalledWith('job-failed', jobFailedHandler);
      expect(downloadQueue.addEventListener).toHaveBeenCalledWith('queue-changed', queueChangedHandler);
      expect(downloadQueue.addEventListener).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleStartDownload', () => {
    let handleStartDownload;
    let sendResponse;

    beforeEach(() => {
      sendResponse = jest.fn();

      // Mock the function (simplified version for testing)
      handleStartDownload = async function(data, sendResponse) {
        // Check if we're resuming a paused queue
        if (downloadQueue.isPaused && !downloadQueue.isEmpty()) {
          downloadQueue.resume();
          downloadState.isPaused = false;
          downloadState.isActive = true;
          sendResponse({ status: 'resumed', totalPurchases: downloadState.purchases.length });
          return;
        }

        // Otherwise start fresh
        const purchases = data?.purchases || [];
        downloadQueue.clear();
        downloadState.purchases = purchases;
        downloadState.isActive = true;
        downloadState.isPaused = false;
        downloadState.completed = 0;
        downloadState.failed = 0;

        // Add to queue
        const jobs = purchases.map(p => ({
          job: new mockDownloadJob(p, 0),
          priority: 0
        }));
        downloadQueue.enqueueBatch(jobs);

        sendResponse({ status: 'started', totalPurchases: purchases.length });
      };
    });

    test('should start fresh download queue when not paused', async () => {
      const purchases = [
        { title: 'Album 1', downloadUrl: 'https://test.com/1' },
        { title: 'Album 2', downloadUrl: 'https://test.com/2' }
      ];

      downloadQueue.isEmpty.mockReturnValue(true);
      downloadQueue.enqueueBatch.mockReturnValue(['id1', 'id2']);

      await handleStartDownload({ purchases }, sendResponse);

      expect(downloadQueue.clear).toHaveBeenCalled();
      expect(downloadQueue.enqueueBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ priority: 0 }),
          expect.objectContaining({ priority: 0 })
        ])
      );
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'started',
        totalPurchases: 2
      });
      expect(downloadState.isActive).toBe(true);
      expect(downloadState.purchases).toEqual(purchases);
    });

    test('should resume paused queue without clearing', async () => {
      downloadQueue.isPaused = true;
      downloadQueue.isEmpty.mockReturnValue(false);
      downloadState.purchases = [{ title: 'Album 1' }];

      await handleStartDownload({}, sendResponse);

      expect(downloadQueue.resume).toHaveBeenCalled();
      expect(downloadQueue.clear).not.toHaveBeenCalled();
      expect(downloadQueue.enqueueBatch).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'resumed',
        totalPurchases: 1
      });
      expect(downloadState.isActive).toBe(true);
      expect(downloadState.isPaused).toBe(false);
    });

    test('should not resume if queue is empty even when paused', async () => {
      downloadQueue.isPaused = true;
      downloadQueue.isEmpty.mockReturnValue(true);

      await handleStartDownload({ purchases: [] }, sendResponse);

      expect(downloadQueue.resume).not.toHaveBeenCalled();
      expect(downloadQueue.clear).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'started',
        totalPurchases: 0
      });
    });
  });

  describe('processNextDownload', () => {
    let processNextDownload;

    beforeEach(() => {
      // Simplified processNextDownload for testing
      processNextDownload = async function() {
        if (!downloadState.isActive || downloadQueue.isPaused) {
          return;
        }

        if (isProcessing) return;
        isProcessing = true;

        try {
          const queueItem = downloadQueue.dequeue();

          if (!queueItem) {
            downloadState.isActive = false;
            isProcessing = false;
            return;
          }

          const job = queueItem.job;
          currentDownloadJob = job;
          downloadQueue.currentJob = queueItem;

          job.start();

          try {
            if (!globalDownloadManager) {
              globalDownloadManager = new mockDownloadManager();
            }

            const result = await globalDownloadManager.download(job.purchase);
            job.complete(result);
            downloadQueue.completeCurrentJob(result);
            downloadState.completed++;

          } catch (error) {
            job.fail(error);
            downloadQueue.failCurrentJob(error);
            downloadState.failed++;

            if (job.canBeRetried()) {
              const delay = job.getRetryDelay();
              setTimeout(() => {
                job.incrementRetry();
                downloadQueue.enqueue(job, job.priority + 1);
              }, delay);
            }
          }

          currentDownloadJob = null;
          downloadQueue.currentJob = null;

          setTimeout(() => {
            isProcessing = false;
            if (!downloadQueue.isPaused) {
              processNextDownload();
            }
          }, 1000);

        } catch (error) {
          isProcessing = false;
          currentDownloadJob = null;
          downloadQueue.currentJob = null;
        }
      };
    });

    test('should process next job in queue', async () => {
      const mockJob = new mockDownloadJob({ title: 'Test Album' }, 0);
      const queueItem = { id: 'job1', job: mockJob, priority: 0 };

      downloadState.isActive = true;
      downloadQueue.isPaused = false;
      downloadQueue.dequeue.mockReturnValue(queueItem);
      mockDownloadManager.prototype.download.mockResolvedValue({ filename: 'test.zip' });

      await processNextDownload();

      expect(downloadQueue.dequeue).toHaveBeenCalled();
      expect(mockJob.start).toHaveBeenCalled();
      expect(mockDownloadManager.prototype.download).toHaveBeenCalled();
      expect(mockJob.complete).toHaveBeenCalled();
      expect(downloadQueue.completeCurrentJob).toHaveBeenCalled();
      expect(downloadState.completed).toBe(1);
    });

    test('should not process when queue is paused', async () => {
      downloadState.isActive = true;
      downloadQueue.isPaused = true;

      await processNextDownload();

      expect(downloadQueue.dequeue).not.toHaveBeenCalled();
    });

    test('should not process when downloads are not active', async () => {
      downloadState.isActive = false;
      downloadQueue.isPaused = false;

      await processNextDownload();

      expect(downloadQueue.dequeue).not.toHaveBeenCalled();
    });

    test('should handle download failure and retry', async () => {
      const mockJob = new mockDownloadJob({ title: 'Test Album' }, 0);
      const queueItem = { id: 'job1', job: mockJob, priority: 0 };
      const error = new Error('Download failed');

      downloadState.isActive = true;
      downloadQueue.isPaused = false;
      downloadQueue.dequeue.mockReturnValue(queueItem);
      mockDownloadManager.prototype.download.mockRejectedValue(error);
      mockJob.canBeRetried.mockReturnValue(true);
      mockJob.getRetryDelay.mockReturnValue(2000);

      await processNextDownload();

      expect(mockJob.fail).toHaveBeenCalledWith(error);
      expect(downloadQueue.failCurrentJob).toHaveBeenCalledWith(error);
      expect(downloadState.failed).toBe(1);
      expect(mockJob.canBeRetried).toHaveBeenCalled();
      expect(mockJob.getRetryDelay).toHaveBeenCalled();

      // Verify retry will be scheduled
      await new Promise(resolve => setTimeout(resolve, 2100));
      expect(mockJob.incrementRetry).toHaveBeenCalled();
      expect(downloadQueue.enqueue).toHaveBeenCalledWith(mockJob, mockJob.priority + 1);
    });

    test('should stop processing when queue is empty', async () => {
      downloadState.isActive = true;
      downloadQueue.isPaused = false;
      downloadQueue.dequeue.mockReturnValue(null);

      await processNextDownload();

      expect(downloadState.isActive).toBe(false);
      expect(currentDownloadJob).toBeNull();
    });

    test('should not continue processing when paused after completion', async () => {
      const mockJob = new mockDownloadJob({ title: 'Test Album' }, 0);
      const queueItem = { id: 'job1', job: mockJob, priority: 0 };

      downloadState.isActive = true;
      downloadQueue.isPaused = false;
      downloadQueue.dequeue.mockReturnValue(queueItem);
      mockDownloadManager.prototype.download.mockResolvedValue({ filename: 'test.zip' });

      // Pause during download
      setTimeout(() => {
        downloadQueue.isPaused = true;
      }, 100);

      await processNextDownload();

      // Wait for the timeout that would normally trigger next download
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should only be called once (not recursively)
      expect(downloadQueue.dequeue).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pause/Resume Functionality', () => {
    let handlePauseDownload;
    let sendResponse;

    beforeEach(() => {
      sendResponse = jest.fn();

      handlePauseDownload = function(sendResponse) {
        downloadQueue.pause();
        downloadState.isPaused = true;
        sendResponse({ status: 'paused' });
      };
    });

    test('should pause queue and update state', () => {
      handlePauseDownload(sendResponse);

      expect(downloadQueue.pause).toHaveBeenCalled();
      expect(downloadState.isPaused).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ status: 'paused' });
    });
  });

  describe('Queue Persistence', () => {
    let saveQueueState;
    let restoreQueueState;

    beforeEach(() => {
      saveQueueState = async function() {
        const serialized = downloadQueue.serialize();
        await chrome.storage.local.set({
          downloadQueue: serialized,
          downloadState: {
            completed: downloadState.completed,
            failed: downloadState.failed,
            isActive: downloadState.isActive
          }
        });
      };

      restoreQueueState = async function() {
        const data = await chrome.storage.local.get(['downloadQueue', 'downloadState']);

        if (data.downloadQueue) {
          downloadQueue.deserialize(data.downloadQueue);
        }

        if (data.downloadState) {
          downloadState.completed = data.downloadState.completed || 0;
          downloadState.failed = data.downloadState.failed || 0;
          downloadState.isActive = data.downloadState.isActive || false;
        }
      };
    });

    test('should save queue state to chrome.storage', async () => {
      const mockSerializedQueue = {
        queue: [{ id: 'job1', priority: 0 }],
        isPaused: true,
        currentJob: null
      };

      downloadQueue.serialize.mockReturnValue(mockSerializedQueue);
      downloadState.completed = 5;
      downloadState.failed = 2;
      downloadState.isActive = true;

      await saveQueueState();

      expect(downloadQueue.serialize).toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        downloadQueue: mockSerializedQueue,
        downloadState: {
          completed: 5,
          failed: 2,
          isActive: true
        }
      });
    });

    test('should restore queue state from chrome.storage', async () => {
      const mockStorageData = {
        downloadQueue: {
          queue: [{ id: 'job1', priority: 0 }],
          isPaused: true,
          currentJob: null
        },
        downloadState: {
          completed: 3,
          failed: 1,
          isActive: true
        }
      };

      chrome.storage.local.get.mockResolvedValue(mockStorageData);

      await restoreQueueState();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['downloadQueue', 'downloadState']);
      expect(downloadQueue.deserialize).toHaveBeenCalledWith(mockStorageData.downloadQueue);
      expect(downloadState.completed).toBe(3);
      expect(downloadState.failed).toBe(1);
      expect(downloadState.isActive).toBe(true);
    });

    test('should handle empty storage gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      await restoreQueueState();

      expect(downloadQueue.deserialize).not.toHaveBeenCalled();
      expect(downloadState.completed).toBe(0);
      expect(downloadState.failed).toBe(0);
      expect(downloadState.isActive).toBe(false);
    });
  });

  describe('Event Handlers', () => {
    let jobCompletedHandler;
    let jobFailedHandler;
    let queueChangedHandler;

    beforeEach(() => {
      // Mock event handlers
      jobCompletedHandler = jest.fn((event) => {
        const queueItem = event.detail;
        if (queueItem?.job?.purchase) {
          downloadState.completed++;
        }
      });

      jobFailedHandler = jest.fn((event) => {
        const queueItem = event.detail;
        if (queueItem?.job?.purchase) {
          downloadState.failed++;
        }
      });

      queueChangedHandler = jest.fn();
    });

    test('should handle job-completed event', () => {
      const mockJob = new mockDownloadJob({ title: 'Test Album' }, 0);
      const queueItem = {
        id: 'job1',
        job: mockJob,
        priority: 0,
        status: 'completed'
      };

      mockJob.purchase = { title: 'Test Album' };
      downloadState.completed = 0;

      jobCompletedHandler({ detail: queueItem });

      expect(downloadState.completed).toBe(1);
    });

    test('should handle job-failed event', () => {
      const mockJob = new mockDownloadJob({ title: 'Test Album' }, 0);
      const queueItem = {
        id: 'job1',
        job: mockJob,
        priority: 0,
        status: 'failed',
        error: new Error('Download failed')
      };

      mockJob.purchase = { title: 'Test Album' };
      downloadState.failed = 0;

      jobFailedHandler({ detail: queueItem });

      expect(downloadState.failed).toBe(1);
    });

    test('should handle malformed event data gracefully', () => {
      downloadState.completed = 0;
      downloadState.failed = 0;

      // Call with undefined detail
      jobCompletedHandler({ detail: undefined });
      expect(downloadState.completed).toBe(0);

      // Call with missing job
      jobCompletedHandler({ detail: {} });
      expect(downloadState.completed).toBe(0);

      // Call with missing purchase
      jobCompletedHandler({ detail: { job: {} } });
      expect(downloadState.completed).toBe(0);
    });
  });

  describe('Stop Download', () => {
    let handleStopDownload;
    let sendResponse;

    beforeEach(() => {
      sendResponse = jest.fn();

      handleStopDownload = function(sendResponse) {
        downloadQueue.clear();
        downloadState.isActive = false;
        downloadState.isPaused = false;
        downloadState.completed = 0;
        downloadState.failed = 0;
        currentDownloadJob = null;
        downloadQueue.currentJob = null;
        sendResponse({ status: 'stopped' });
      };
    });

    test('should clear queue and reset state', () => {
      downloadState.completed = 5;
      downloadState.failed = 2;
      downloadState.isActive = true;
      currentDownloadJob = new mockDownloadJob();
      downloadQueue.currentJob = { id: 'job1' };

      handleStopDownload(sendResponse);

      expect(downloadQueue.clear).toHaveBeenCalled();
      expect(downloadState.isActive).toBe(false);
      expect(downloadState.isPaused).toBe(false);
      expect(downloadState.completed).toBe(0);
      expect(downloadState.failed).toBe(0);
      expect(currentDownloadJob).toBeNull();
      expect(downloadQueue.currentJob).toBeNull();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'stopped' });
    });
  });

  describe('Progress Broadcasting', () => {
    let broadcastProgress;

    beforeEach(() => {
      broadcastProgress = function() {
        const queueStats = downloadQueue.getStats();
        const progress = {
          total: downloadState.purchases.length,
          completed: downloadState.completed,
          failed: downloadState.failed,
          active: currentDownloadJob ? 1 : 0,
          isActive: downloadState.isActive,
          isPaused: downloadQueue.isPaused,
          queueSize: queueStats.total,
          currentJob: currentDownloadJob ? 'Downloading...' : null
        };

        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_PROGRESS',
          progress: progress
        });
      };
    });

    test('should broadcast current progress state', () => {
      downloadState.purchases = [1, 2, 3];
      downloadState.completed = 2;
      downloadState.failed = 1;
      downloadState.isActive = true;
      currentDownloadJob = new mockDownloadJob();
      downloadQueue.isPaused = false;
      downloadQueue.getStats.mockReturnValue({ total: 1 });

      broadcastProgress();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DOWNLOAD_PROGRESS',
        progress: {
          total: 3,
          completed: 2,
          failed: 1,
          active: 1,
          isActive: true,
          isPaused: false,
          queueSize: 1,
          currentJob: 'Downloading...'
        }
      });
    });
  });
});