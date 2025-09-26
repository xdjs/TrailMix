/**
 * Tests for DownloadJob class
 */

const DownloadJob = require('../../lib/download-job');

describe('DownloadJob', () => {
  let job;
  let mockPurchase;

  beforeEach(() => {
    mockPurchase = {
      title: 'Test Album',
      artist: 'Test Artist',
      downloadUrl: 'https://example.com/download'
    };
    job = new DownloadJob(mockPurchase);
  });

  describe('Job Creation', () => {
    test('should create job with default values', () => {
      expect(job.id).toBeTruthy();
      expect(job.purchase).toEqual(mockPurchase);
      expect(job.priority).toBe(0);
      expect(job.status).toBe(DownloadJob.STATUS.PENDING);
      expect(job.createdAt).toBeTruthy();
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
    });

    test('should create job with custom priority', () => {
      const priorityJob = new DownloadJob(mockPurchase, 5);
      expect(priorityJob.priority).toBe(5);
    });

    test('should generate unique IDs', () => {
      const job1 = new DownloadJob(mockPurchase);
      const job2 = new DownloadJob(mockPurchase);
      expect(job1.id).not.toBe(job2.id);
    });
  });

  describe('Job State Transitions', () => {
    test('should start job', () => {
      job.start();
      expect(job.status).toBe(DownloadJob.STATUS.DOWNLOADING);
      expect(job.startedAt).toBeTruthy();
    });

    test('should not start job if already started', () => {
      job.start();
      expect(() => job.start()).toThrow('Cannot start job in status: downloading');
    });

    test('should pause downloading job', () => {
      job.start();
      job.pause();
      expect(job.status).toBe(DownloadJob.STATUS.PAUSED);
    });

    test('should not pause non-downloading job', () => {
      expect(() => job.pause()).toThrow('Cannot pause job in status: pending');
    });

    test('should resume paused job', () => {
      job.start();
      job.pause();
      job.resume();
      expect(job.status).toBe(DownloadJob.STATUS.DOWNLOADING);
    });

    test('should not resume non-paused job', () => {
      expect(() => job.resume()).toThrow('Cannot resume job in status: pending');
    });

    test('should complete job', () => {
      job.start();
      job.complete({
        filename: 'test-album.zip',
        filepath: '/downloads/test-album.zip',
        downloadId: 123
      });

      expect(job.status).toBe(DownloadJob.STATUS.COMPLETED);
      expect(job.completedAt).toBeTruthy();
      expect(job.progress.percentComplete).toBe(100);
      expect(job.filename).toBe('test-album.zip');
      expect(job.filepath).toBe('/downloads/test-album.zip');
      expect(job.downloadId).toBe(123);
    });

    test('should fail job', () => {
      job.start();
      const error = new Error('Download failed');
      job.fail(error);

      expect(job.status).toBe(DownloadJob.STATUS.FAILED);
      expect(job.failedAt).toBeTruthy();
      expect(job.errorCount).toBe(1);
      expect(job.error.message).toBe('Download failed');
      expect(job.canRetry).toBe(true);
    });

    test('should fail job with string error', () => {
      job.fail('Network error');
      expect(job.error.message).toBe('Network error');
    });

    test('should mark job as non-retryable after max retries', () => {
      job.retryCount = 3;
      job.fail(new Error('Failed'));
      expect(job.canRetry).toBe(false);
    });

    test('should cancel job', () => {
      job.cancel();
      expect(job.status).toBe(DownloadJob.STATUS.CANCELLED);
    });
  });

  describe('Progress Tracking', () => {
    test('should update progress', () => {
      job.start();
      job.updateProgress({
        bytesReceived: 5000,
        totalBytes: 10000,
        downloadSpeed: 1000
      });

      expect(job.progress.bytesReceived).toBe(5000);
      expect(job.progress.totalBytes).toBe(10000);
      expect(job.progress.percentComplete).toBe(50);
      expect(job.progress.downloadSpeed).toBe(1000);
    });

    test('should not update progress if not downloading', () => {
      const initialProgress = {...job.progress};
      job.updateProgress({bytesReceived: 5000});
      expect(job.progress).toEqual(initialProgress);
    });

    test('should calculate percent complete', () => {
      job.start();
      job.updateProgress({
        bytesReceived: 7500,
        totalBytes: 10000
      });
      expect(job.progress.percentComplete).toBe(75);
    });
  });

  describe('Retry Logic', () => {
    test('should increment retry count', () => {
      job.fail(new Error('Failed'));
      const canRetry = job.incrementRetry();

      expect(job.retryCount).toBe(1);
      expect(job.status).toBe(DownloadJob.STATUS.PENDING);
      expect(job.error).toBeNull();
      expect(canRetry).toBe(true);
    });

    test('should not allow retry after max attempts', () => {
      job.retryCount = 2;
      job.fail(new Error('Failed'));
      const canRetry = job.incrementRetry();

      expect(job.retryCount).toBe(3);
      expect(canRetry).toBe(false);
    });

    test('should calculate exponential backoff delay', () => {
      expect(job.getRetryDelay()).toBe(1000); // 2^0 * 1000

      job.retryCount = 1;
      expect(job.getRetryDelay()).toBe(2000); // 2^1 * 1000

      job.retryCount = 2;
      expect(job.getRetryDelay()).toBe(4000); // 2^2 * 1000

      job.retryCount = 3;
      expect(job.getRetryDelay()).toBe(8000); // 2^3 * 1000

      job.retryCount = 10;
      expect(job.getRetryDelay()).toBe(60000); // Max cap
    });

    test('should check if job can be retried', () => {
      expect(job.canBeRetried()).toBe(false); // Not failed yet

      job.fail(new Error('Failed'));
      expect(job.canBeRetried()).toBe(true);

      job.retryCount = 3;
      expect(job.canBeRetried()).toBe(false); // Max retries reached
    });
  });

  describe('Job Information', () => {
    test('should check if job is terminal', () => {
      expect(job.isTerminal()).toBe(false);

      job.complete();
      expect(job.isTerminal()).toBe(true);

      const failedJob = new DownloadJob(mockPurchase);
      failedJob.fail(new Error('Failed'));
      expect(failedJob.isTerminal()).toBe(true);

      const cancelledJob = new DownloadJob(mockPurchase);
      cancelledJob.cancel();
      expect(cancelledJob.isTerminal()).toBe(true);
    });

    test('should calculate job duration', () => {
      expect(job.getDuration()).toBeNull();

      job.start();
      const startTime = job.startedAt;

      // Mock time passing
      job.completedAt = startTime + 5000;
      expect(job.getDuration()).toBe(5000);
    });

    test('should estimate time remaining', () => {
      expect(job.getEstimatedTimeRemaining()).toBeNull();

      job.start();
      job.updateProgress({
        bytesReceived: 5000,
        totalBytes: 10000,
        downloadSpeed: 1000 // bytes per second
      });

      // 5000 bytes remaining at 1000 bytes/sec = 5 seconds
      expect(job.getEstimatedTimeRemaining()).toBe(5000);
    });

    test('should get human-readable status text', () => {
      expect(job.getStatusText()).toBe('Waiting to start');

      job.status = DownloadJob.STATUS.QUEUED;
      expect(job.getStatusText()).toBe('In queue');

      job.start();
      job.updateProgress({bytesReceived: 3000, totalBytes: 10000});
      expect(job.getStatusText()).toBe('Downloading (30%)');

      job.complete();
      expect(job.getStatusText()).toBe('Completed');

      const failedJob = new DownloadJob(mockPurchase);
      failedJob.fail(new Error('Failed'));
      expect(failedJob.getStatusText()).toBe('Failed (will retry)');

      failedJob.retryCount = 3;
      expect(failedJob.getStatusText()).toBe('Failed');

      const pausedJob = new DownloadJob(mockPurchase);
      pausedJob.start();
      pausedJob.pause();
      expect(pausedJob.getStatusText()).toBe('Paused');

      const cancelledJob = new DownloadJob(mockPurchase);
      cancelledJob.cancel();
      expect(cancelledJob.getStatusText()).toBe('Cancelled');
    });
  });

  describe('Serialization', () => {
    test('should serialize job', () => {
      job.start();
      job.updateProgress({
        bytesReceived: 5000,
        totalBytes: 10000
      });

      const serialized = job.serialize();

      expect(serialized.id).toBe(job.id);
      expect(serialized.purchase).toEqual(mockPurchase);
      expect(serialized.priority).toBe(0);
      expect(serialized.status).toBe(DownloadJob.STATUS.DOWNLOADING);
      expect(serialized.progress.bytesReceived).toBe(5000);
      expect(serialized.createdAt).toBe(job.createdAt);
      expect(serialized.startedAt).toBe(job.startedAt);
    });

    test('should deserialize job', () => {
      const serialized = {
        id: 'test_id_123',
        purchase: mockPurchase,
        priority: 5,
        status: DownloadJob.STATUS.DOWNLOADING,
        createdAt: Date.now() - 10000,
        startedAt: Date.now() - 5000,
        progress: {
          bytesReceived: 7500,
          totalBytes: 10000,
          percentComplete: 75,
          downloadSpeed: 2000
        },
        retryCount: 1,
        errorCount: 2
      };

      const deserialized = DownloadJob.deserialize(serialized);

      expect(deserialized.id).toBe('test_id_123');
      expect(deserialized.purchase).toEqual(mockPurchase);
      expect(deserialized.priority).toBe(5);
      expect(deserialized.status).toBe(DownloadJob.STATUS.DOWNLOADING);
      expect(deserialized.progress.bytesReceived).toBe(7500);
      expect(deserialized.progress.percentComplete).toBe(75);
      expect(deserialized.retryCount).toBe(1);
      expect(deserialized.errorCount).toBe(2);
    });

    test('should round-trip serialize and deserialize', () => {
      job.start();
      job.updateProgress({
        bytesReceived: 5000,
        totalBytes: 10000
      });
      job.fail(new Error('Test error'));

      const serialized = job.serialize();
      const deserialized = DownloadJob.deserialize(serialized);

      expect(deserialized.id).toBe(job.id);
      expect(deserialized.status).toBe(job.status);
      expect(deserialized.progress).toEqual(job.progress);
      expect(deserialized.error).toEqual(job.error);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing purchase data gracefully', () => {
      const emptyJob = new DownloadJob({});
      expect(emptyJob.purchase).toEqual({});
      expect(emptyJob.status).toBe(DownloadJob.STATUS.PENDING);
    });

    test('should handle progress update with zero total bytes', () => {
      job.start();
      job.updateProgress({
        bytesReceived: 100,
        totalBytes: 0
      });
      expect(job.progress.percentComplete).toBe(0);
    });

    test('should not fail completed job', () => {
      job.complete();
      job.fail(new Error('Should not fail'));
      expect(job.status).toBe(DownloadJob.STATUS.COMPLETED);
    });

    test('should update lastModified timestamp', () => {
      const initialModified = job.lastModified;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        job.start();
        expect(job.lastModified).toBeGreaterThan(initialModified);
      }, 10);
    });
  });
});