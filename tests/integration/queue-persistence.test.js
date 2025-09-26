/**
 * Integration tests for Queue Persistence and Pause/Resume
 */

const DownloadQueue = require('../../lib/download-queue');
const DownloadJob = require('../../lib/download-job');

describe('Queue Persistence Integration', () => {
  let chrome;
  let queue;
  let storageData;

  beforeEach(() => {
    // Setup chrome storage mock
    storageData = {};
    chrome = {
      storage: {
        local: {
          set: jest.fn().mockImplementation((data) => {
            Object.assign(storageData, data);
            return Promise.resolve();
          }),
          get: jest.fn().mockImplementation((keys) => {
            const result = {};
            keys.forEach(key => {
              if (storageData[key]) {
                result[key] = storageData[key];
              }
            });
            return Promise.resolve(result);
          })
        }
      },
      runtime: {
        sendMessage: jest.fn().mockResolvedValue()
      }
    };
    global.chrome = chrome;

    queue = new DownloadQueue();
  });

  describe('Save and Restore Queue State', () => {
    test('should persist and restore complete queue state', async () => {
      // Create test jobs
      const purchases = [
        { title: 'Album 1', artist: 'Artist 1', downloadUrl: 'https://test.com/1' },
        { title: 'Album 2', artist: 'Artist 2', downloadUrl: 'https://test.com/2' },
        { title: 'Album 3', artist: 'Artist 3', downloadUrl: 'https://test.com/3' }
      ];

      const jobs = purchases.map((purchase, index) => ({
        job: new DownloadJob(purchase, index),
        priority: index
      }));

      queue.enqueueBatch(jobs);
      queue.pause();

      // Save state
      const serialized = queue.serialize();
      await chrome.storage.local.set({
        downloadQueue: serialized,
        downloadState: {
          completed: 5,
          failed: 2,
          isActive: true
        }
      });

      // Create new queue and restore
      const newQueue = new DownloadQueue();
      const restored = await chrome.storage.local.get(['downloadQueue', 'downloadState']);

      newQueue.deserialize(restored.downloadQueue);

      // Verify restoration
      expect(newQueue.getStats().total).toBe(3);
      expect(newQueue.isPaused).toBe(true);
      expect(restored.downloadState.completed).toBe(5);
      expect(restored.downloadState.failed).toBe(2);
    });

    test('should restore queue with job states intact', async () => {
      const purchase = { title: 'Test Album', downloadUrl: 'https://test.com/1' };
      const job = new DownloadJob(purchase, 5);

      // Simulate a job that has been started and partially downloaded
      job.start();
      job.updateProgress({
        bytesReceived: 5000,
        totalBytes: 10000,
        downloadSpeed: 1000
      });
      job.retryCount = 2;

      queue.enqueue(job, 5);

      // Save state
      const serialized = queue.serialize();
      await chrome.storage.local.set({ downloadQueue: serialized });

      // Restore to new queue
      const newQueue = new DownloadQueue();
      const restored = await chrome.storage.local.get(['downloadQueue']);
      newQueue.deserialize(restored.downloadQueue);

      // Get the restored job
      const restoredItem = newQueue.peek();
      expect(restoredItem).toBeTruthy();
      expect(restoredItem.priority).toBe(5);

      // Deserialize the job to check its state
      const restoredJob = DownloadJob.deserialize(restoredItem.job);
      expect(restoredJob.status).toBe(DownloadJob.STATUS.DOWNLOADING);
      expect(restoredJob.progress.bytesReceived).toBe(5000);
      expect(restoredJob.progress.percentComplete).toBe(50);
      expect(restoredJob.retryCount).toBe(2);
    });

    test('should handle empty queue on restore', async () => {
      // Save empty state
      await chrome.storage.local.set({
        downloadQueue: queue.serialize(),
        downloadState: {
          completed: 0,
          failed: 0,
          isActive: false
        }
      });

      // Restore
      const newQueue = new DownloadQueue();
      const restored = await chrome.storage.local.get(['downloadQueue', 'downloadState']);

      newQueue.deserialize(restored.downloadQueue);

      expect(newQueue.isEmpty()).toBe(true);
      expect(newQueue.isPaused).toBe(false);
      expect(restored.downloadState.isActive).toBe(false);
    });
  });

  describe('Pause/Resume Workflow', () => {
    test('should maintain queue order through pause/resume cycle', () => {
      const purchases = [
        { title: 'High Priority', downloadUrl: 'https://test.com/1' },
        { title: 'Medium Priority', downloadUrl: 'https://test.com/2' },
        { title: 'Low Priority', downloadUrl: 'https://test.com/3' }
      ];

      // Add with different priorities
      queue.enqueue(new DownloadJob(purchases[0], 10), 10);
      queue.enqueue(new DownloadJob(purchases[1], 5), 5);
      queue.enqueue(new DownloadJob(purchases[2], 1), 1);

      // Get initial order
      const firstJob = queue.dequeue();
      expect(firstJob.job.purchase.title).toBe('High Priority');

      // Pause
      queue.pause();
      expect(queue.isPaused).toBe(true);

      // Resume
      queue.resume();
      expect(queue.isPaused).toBe(false);

      // Check order is maintained
      const secondJob = queue.dequeue();
      expect(secondJob.job.purchase.title).toBe('Medium Priority');

      const thirdJob = queue.dequeue();
      expect(thirdJob.job.purchase.title).toBe('Low Priority');
    });

    test('should track current job through pause/resume', () => {
      const job = new DownloadJob({ title: 'Current Download' }, 0);
      queue.enqueue(job, 0);

      // Start processing
      const currentItem = queue.dequeue();
      queue.currentJob = currentItem;

      // Pause with active job
      queue.pause();

      // Serialize and restore
      const serialized = queue.serialize();
      expect(serialized.currentJob).toEqual(currentItem);

      // Create new queue and restore
      const newQueue = new DownloadQueue();
      newQueue.deserialize(serialized);

      expect(newQueue.currentJob).toEqual(currentItem);
      expect(newQueue.isPaused).toBe(true);

      // Resume and complete current job
      newQueue.resume();
      newQueue.completeCurrentJob({ filename: 'test.zip' });

      expect(newQueue.currentJob).toBeNull();
    });
  });

  describe('Browser Restart Simulation', () => {
    test('should resume downloads after simulated browser restart', async () => {
      // Setup initial state with downloads in progress
      const purchases = [
        { title: 'Completed Album', downloadUrl: 'https://test.com/1' },
        { title: 'Current Album', downloadUrl: 'https://test.com/2' },
        { title: 'Pending Album 1', downloadUrl: 'https://test.com/3' },
        { title: 'Pending Album 2', downloadUrl: 'https://test.com/4' }
      ];

      const jobs = purchases.map(p => new DownloadJob(p, 0));

      // First job completed
      jobs[0].complete();

      // Second job in progress
      jobs[1].start();
      jobs[1].updateProgress({ bytesReceived: 3000, totalBytes: 10000 });

      // Add remaining jobs to queue
      queue.enqueue(jobs[2], 0);
      queue.enqueue(jobs[3], 0);

      // Set current job
      queue.currentJob = {
        id: 'current',
        job: jobs[1],
        priority: 0,
        status: 'downloading'
      };

      // Save state before "crash"
      const stateBeforeCrash = {
        queue: queue.serialize(),
        downloadState: {
          completed: 1,
          failed: 0,
          isActive: true,
          purchases: purchases
        }
      };

      await chrome.storage.local.set({
        downloadQueue: stateBeforeCrash.queue,
        downloadState: stateBeforeCrash.downloadState
      });

      // Simulate browser restart - create new queue
      const restoredQueue = new DownloadQueue();
      const restoredData = await chrome.storage.local.get(['downloadQueue', 'downloadState']);

      restoredQueue.deserialize(restoredData.downloadQueue);

      // Verify state restoration
      expect(restoredQueue.getStats().total).toBe(2); // 2 pending
      expect(restoredQueue.currentJob).toBeTruthy();
      expect(restoredQueue.currentJob.job.status).toBe(DownloadJob.STATUS.DOWNLOADING);
      expect(restoredData.downloadState.completed).toBe(1);
      expect(restoredData.downloadState.isActive).toBe(true);

      // Verify can continue processing
      const nextJob = restoredQueue.dequeue();
      expect(nextJob.job.purchase.title).toBe('Pending Album 1');
    });
  });

  describe('Retry Queue Management', () => {
    test('should maintain retry jobs with higher priority', () => {
      const normalJob = new DownloadJob({ title: 'Normal Priority' }, 0);
      const failedJob = new DownloadJob({ title: 'Failed - Retry' }, 0);

      // Failed job has been retried once
      failedJob.retryCount = 1;
      failedJob.status = DownloadJob.STATUS.FAILED;

      // Add normal job first
      queue.enqueue(normalJob, 0);

      // Add retry job with higher priority
      queue.enqueue(failedJob, 1);

      // Retry should come first
      const first = queue.dequeue();
      expect(first.job.purchase.title).toBe('Failed - Retry');

      const second = queue.dequeue();
      expect(second.job.purchase.title).toBe('Normal Priority');
    });

    test('should preserve retry count through persistence', async () => {
      const job = new DownloadJob({ title: 'Retry Test' }, 0);
      job.retryCount = 2;
      job.maxRetries = 3;
      job.errorCount = 2;
      job.status = DownloadJob.STATUS.FAILED; // Need to set status to FAILED
      job.error = { message: 'Network timeout' };

      queue.enqueue(job, 2);

      // Save and restore
      const serialized = queue.serialize();
      await chrome.storage.local.set({ downloadQueue: serialized });

      const newQueue = new DownloadQueue();
      const restored = await chrome.storage.local.get(['downloadQueue']);
      newQueue.deserialize(restored.downloadQueue);

      const restoredItem = newQueue.dequeue();
      const restoredJob = DownloadJob.deserialize(restoredItem.job);

      expect(restoredJob.retryCount).toBe(2);
      expect(restoredJob.maxRetries).toBe(3);
      expect(restoredJob.errorCount).toBe(2);
      expect(restoredJob.error.message).toBe('Network timeout');
      expect(restoredJob.status).toBe(DownloadJob.STATUS.FAILED);
      // Retry count is 2, max is 3, so one more retry is allowed (2 < 3)
      expect(restoredJob.canBeRetried()).toBe(true);
    });
  });

  describe('Event Persistence', () => {
    test('should emit queue-restored event after deserialization', (done) => {
      const testData = {
        queue: [
          { id: 'job1', job: new DownloadJob({ title: 'Album 1' }, 0), priority: 0 },
          { id: 'job2', job: new DownloadJob({ title: 'Album 2' }, 0), priority: 0 }
        ],
        isPaused: false
      };

      queue.addEventListener('queue-restored', (event) => {
        expect(event.detail.size).toBe(2);
        expect(event.detail.isPaused).toBe(false);
        done();
      });

      queue.deserialize(testData);
    });
  });

  describe('Edge Cases', () => {
    test('should handle corrupted storage data gracefully', async () => {
      // Save corrupted data
      await chrome.storage.local.set({
        downloadQueue: 'invalid-json-string',
        downloadState: null
      });

      // Attempt to restore
      const newQueue = new DownloadQueue();
      const restored = await chrome.storage.local.get(['downloadQueue', 'downloadState']);

      // Should not throw, queue should remain empty
      expect(() => {
        newQueue.deserialize(restored.downloadQueue);
      }).not.toThrow();

      expect(newQueue.isEmpty()).toBe(true);
    });

    test('should handle partial state restoration', async () => {
      // Save only downloadState, no queue
      await chrome.storage.local.set({
        downloadState: {
          completed: 10,
          failed: 2,
          isActive: false
        }
      });

      const restored = await chrome.storage.local.get(['downloadQueue', 'downloadState']);

      expect(restored.downloadState).toBeDefined();
      expect(restored.downloadState.completed).toBe(10);
      expect(restored.downloadQueue).toBeUndefined();
    });

    test('should clear persisted state when stopping downloads', async () => {
      // Setup some state
      queue.enqueue(new DownloadJob({ title: 'Test' }, 0), 0);
      await chrome.storage.local.set({
        downloadQueue: queue.serialize(),
        downloadState: { completed: 5, failed: 1, isActive: true }
      });

      // Simulate stop downloads
      queue.clear();
      await chrome.storage.local.set({
        downloadQueue: queue.serialize(),
        downloadState: { completed: 0, failed: 0, isActive: false }
      });

      const restored = await chrome.storage.local.get(['downloadQueue', 'downloadState']);
      const newQueue = new DownloadQueue();
      newQueue.deserialize(restored.downloadQueue);

      expect(newQueue.isEmpty()).toBe(true);
      expect(restored.downloadState.completed).toBe(0);
      expect(restored.downloadState.failed).toBe(0);
      expect(restored.downloadState.isActive).toBe(false);
    });
  });
});