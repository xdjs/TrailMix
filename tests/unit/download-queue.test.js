/**
 * Tests for DownloadQueue class
 */

const DownloadQueue = require('../../lib/download-queue');
const DownloadJob = require('../../lib/download-job');

describe('DownloadQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new DownloadQueue();
  });

  describe('Basic Queue Operations', () => {
    test('should create empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.getStats().total).toBe(0);
    });

    test('should enqueue single job', () => {
      const job = {title: 'Test Album', artist: 'Test Artist'};
      const id = queue.enqueue(job);

      expect(id).toBeTruthy();
      expect(queue.isEmpty()).toBe(false);
      expect(queue.getStats().total).toBe(1);
    });

    test('should dequeue job in FIFO order with same priority', () => {
      const job1 = {title: 'Album 1'};
      const job2 = {title: 'Album 2'};
      const job3 = {title: 'Album 3'};

      queue.enqueue(job1, 0);
      queue.enqueue(job2, 0);
      queue.enqueue(job3, 0);

      const dequeued1 = queue.dequeue();
      const dequeued2 = queue.dequeue();
      const dequeued3 = queue.dequeue();

      expect(dequeued1.job.title).toBe('Album 1');
      expect(dequeued2.job.title).toBe('Album 2');
      expect(dequeued3.job.title).toBe('Album 3');
    });

    test('should dequeue higher priority jobs first', () => {
      const lowPriority = {title: 'Low Priority'};
      const highPriority = {title: 'High Priority'};
      const mediumPriority = {title: 'Medium Priority'};

      queue.enqueue(lowPriority, 1);
      queue.enqueue(highPriority, 10);
      queue.enqueue(mediumPriority, 5);

      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();

      expect(first.job.title).toBe('High Priority');
      expect(second.job.title).toBe('Medium Priority');
      expect(third.job.title).toBe('Low Priority');
    });

    test('should return null when dequeuing empty queue', () => {
      const result = queue.dequeue();
      expect(result).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    test('should enqueue multiple jobs in batch', () => {
      const jobs = [
        {job: {title: 'Album 1'}, priority: 0},
        {job: {title: 'Album 2'}, priority: 0},
        {job: {title: 'Album 3'}, priority: 0}
      ];

      const ids = queue.enqueueBatch(jobs);

      expect(ids).toHaveLength(3);
      expect(queue.getStats().total).toBe(3);
    });

    test('should remove multiple jobs in batch', () => {
      const jobs = [
        {job: {title: 'Album 1'}, priority: 0},
        {job: {title: 'Album 2'}, priority: 0},
        {job: {title: 'Album 3'}, priority: 0}
      ];

      const ids = queue.enqueueBatch(jobs);
      const removed = queue.removeBatch([ids[0], ids[2]]);

      expect(removed).toBe(2);
      expect(queue.getStats().total).toBe(1);

      const remaining = queue.dequeue();
      expect(remaining.job.title).toBe('Album 2');
    });
  });

  describe('Queue Management', () => {
    test('should remove specific job by ID', () => {
      const job1 = {title: 'Album 1'};
      const job2 = {title: 'Album 2'};

      const id1 = queue.enqueue(job1);
      const id2 = queue.enqueue(job2);

      const removed = queue.remove(id1);
      expect(removed).toBe(true);
      expect(queue.getStats().total).toBe(1);

      const remaining = queue.dequeue();
      expect(remaining.id).toBe(id2);
    });

    test('should return false when removing non-existent job', () => {
      const removed = queue.remove('non-existent-id');
      expect(removed).toBe(false);
    });

    test('should reorder job priority', () => {
      const job1 = {title: 'Album 1'};
      const job2 = {title: 'Album 2'};

      const id1 = queue.enqueue(job1, 1);
      const id2 = queue.enqueue(job2, 5);

      // Initially, job2 should be first due to higher priority
      expect(queue.peek().id).toBe(id2);

      // Reorder job1 to higher priority
      queue.reorder(id1, 10);

      // Now job1 should be first
      expect(queue.peek().id).toBe(id1);
    });

    test('should move job to specific position', () => {
      const jobs = [
        {title: 'Album 1'},
        {title: 'Album 2'},
        {title: 'Album 3'}
      ];

      const ids = jobs.map(job => queue.enqueue(job, 0));

      // Move last job to first position
      const moved = queue.moveToPosition(ids[2], 0);
      expect(moved).toBe(true);

      const first = queue.dequeue();
      expect(first.job.title).toBe('Album 3');
    });

    test('should clear all jobs', () => {
      queue.enqueue({title: 'Album 1'});
      queue.enqueue({title: 'Album 2'});
      queue.enqueue({title: 'Album 3'});

      expect(queue.getStats().total).toBe(3);

      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.getStats().total).toBe(0);
    });
  });

  describe('Pause/Resume Functionality', () => {
    test('should pause queue', () => {
      queue.pause();
      expect(queue.isPaused).toBe(true);
      expect(queue.getState().isPaused).toBe(true);
    });

    test('should resume queue', () => {
      queue.pause();
      queue.resume();
      expect(queue.isPaused).toBe(false);
      expect(queue.getState().isPaused).toBe(false);
    });
  });

  describe('Job State Management', () => {
    test('should complete current job', () => {
      const job = {title: 'Test Album'};
      queue.enqueue(job);

      const dequeued = queue.dequeue();
      queue.currentJob = dequeued;

      queue.completeCurrentJob({filename: 'test.zip'});

      expect(queue.currentJob).toBeNull();
    });

    test('should fail current job', () => {
      const job = {title: 'Test Album'};
      queue.enqueue(job);

      const dequeued = queue.dequeue();
      queue.currentJob = dequeued;

      queue.failCurrentJob(new Error('Download failed'));

      expect(queue.currentJob).toBeNull();
    });
  });

  describe('Queue Persistence', () => {
    test('should serialize queue state', () => {
      const job1 = {title: 'Album 1'};
      const job2 = {title: 'Album 2'};

      queue.enqueue(job1, 5);
      queue.enqueue(job2, 3);
      queue.pause();

      const serialized = queue.serialize();

      expect(serialized.queue).toHaveLength(2);
      expect(serialized.isPaused).toBe(true);
      expect(serialized.queue[0].priority).toBe(5);
      expect(serialized.queue[1].priority).toBe(3);
    });

    test('should deserialize queue state', () => {
      const serialized = {
        queue: [
          {
            id: 'job_1',
            job: {title: 'Album 1'},
            priority: 5,
            timestamp: Date.now(),
            status: 'pending'
          },
          {
            id: 'job_2',
            job: {title: 'Album 2'},
            priority: 3,
            timestamp: Date.now(),
            status: 'pending'
          }
        ],
        isPaused: true,
        currentJob: null
      };

      queue.deserialize(serialized);

      expect(queue.getStats().total).toBe(2);
      expect(queue.isPaused).toBe(true);
      expect(queue.peek().id).toBe('job_1');
    });
  });

  describe('Queue Statistics', () => {
    test('should provide queue statistics', () => {
      queue.enqueue({title: 'High 1'}, 10);
      queue.enqueue({title: 'High 2'}, 10);
      queue.enqueue({title: 'Medium'}, 5);
      queue.enqueue({title: 'Low'}, 1);

      const stats = queue.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byPriority[10]).toBe(2);
      expect(stats.byPriority[5]).toBe(1);
      expect(stats.byPriority[1]).toBe(1);
      expect(stats.isPaused).toBe(false);
      expect(stats.hasCurrentJob).toBe(false);
    });

    test('should get queue state', () => {
      const job1 = {title: 'Album 1'};
      const job2 = {title: 'Album 2'};

      queue.enqueue(job1);
      queue.enqueue(job2);
      queue.pause();

      const state = queue.getState();

      expect(state.size).toBe(2);
      expect(state.isPaused).toBe(true);
      expect(state.isProcessing).toBe(false);
      expect(state.currentJob).toBeNull();
      expect(state.queue).toHaveLength(2);
    });
  });

  describe('Job Lookup', () => {
    test('should find job by ID', () => {
      const job = {title: 'Test Album'};
      const id = queue.enqueue(job);

      const found = queue.findJob(id);
      expect(found).toBeTruthy();
      expect(found.id).toBe(id);
      expect(found.job.title).toBe('Test Album');
    });

    test('should return null for non-existent job', () => {
      const found = queue.findJob('non-existent');
      expect(found).toBeNull();
    });

    test('should peek at next job without removing', () => {
      const job1 = {title: 'Album 1'};
      const job2 = {title: 'Album 2'};

      const id1 = queue.enqueue(job1);
      queue.enqueue(job2);

      const peeked = queue.peek();
      expect(peeked.id).toBe(id1);

      // Queue should still have both items
      expect(queue.getStats().total).toBe(2);
    });
  });

  describe('Event Handling', () => {
    test('should emit job-added event', (done) => {
      queue.addEventListener('job-added', (event) => {
        expect(event.detail.job.title).toBe('Test Album');
        done();
      });

      queue.enqueue({title: 'Test Album'});
    });

    test('should emit queue-changed event', (done) => {
      queue.addEventListener('queue-changed', (event) => {
        expect(event.detail.size).toBe(1);
        done();
      });

      queue.enqueue({title: 'Test Album'});
    });

    test('should emit batch-added event', (done) => {
      queue.addEventListener('batch-added', (event) => {
        expect(event.detail.count).toBe(3);
        expect(event.detail.ids).toHaveLength(3);
        done();
      });

      queue.enqueueBatch([
        {job: {title: 'Album 1'}, priority: 0},
        {job: {title: 'Album 2'}, priority: 0},
        {job: {title: 'Album 3'}, priority: 0}
      ]);
    });

    test('should emit job-removed event', (done) => {
      const id = queue.enqueue({title: 'Test Album'});

      queue.addEventListener('job-removed', (event) => {
        expect(event.detail.id).toBe(id);
        done();
      });

      queue.remove(id);
    });

    test('should emit queue-paused event', (done) => {
      queue.addEventListener('queue-paused', () => {
        expect(queue.isPaused).toBe(true);
        done();
      });

      queue.pause();
    });

    test('should emit queue-resumed event', (done) => {
      queue.pause();

      queue.addEventListener('queue-resumed', () => {
        expect(queue.isPaused).toBe(false);
        done();
      });

      queue.resume();
    });
  });

  describe('Performance with Large Queues', () => {
    test('should handle large queue efficiently', () => {
      const startTime = Date.now();

      // Add 100 jobs
      for (let i = 0; i < 100; i++) {
        queue.enqueue({title: `Album ${i}`}, Math.random() * 10);
      }

      const enqueueTime = Date.now() - startTime;
      expect(enqueueTime).toBeLessThan(100); // Should take less than 100ms

      expect(queue.getStats().total).toBe(100);

      // Dequeue all jobs
      const dequeueStart = Date.now();
      while (!queue.isEmpty()) {
        queue.dequeue();
      }
      const dequeueTime = Date.now() - dequeueStart;

      expect(dequeueTime).toBeLessThan(100); // Should take less than 100ms
      expect(queue.isEmpty()).toBe(true);
    });

    test('should maintain priority order with many jobs', () => {
      const jobs = [];
      for (let i = 0; i < 50; i++) {
        const priority = Math.floor(Math.random() * 100);
        queue.enqueue({title: `Album ${i}`, priority}, priority);
        jobs.push(priority);
      }

      jobs.sort((a, b) => b - a); // Sort descending

      // Dequeue and verify order
      let prevPriority = Infinity;
      while (!queue.isEmpty()) {
        const job = queue.dequeue();
        expect(job.priority).toBeLessThanOrEqual(prevPriority);
        prevPriority = job.priority;
      }
    });
  });
});