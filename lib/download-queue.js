/**
 * Download Queue Management System
 *
 * Manages download jobs with priority, batch operations, and persistence
 */

class DownloadQueue extends EventTarget {
  constructor() {
    super();
    this.queue = [];
    this.currentJob = null;
    this.isProcessing = false;
    this.isPaused = false;
  }

  /**
   * Add a job to the queue
   * @param {Object} job - Download job to add
   * @param {number} priority - Priority level (higher = more important)
   * @returns {string} Job ID
   */
  enqueue(job, priority = 0) {
    const jobId = this._generateId();
    const queueItem = {
      id: jobId,
      job,
      priority,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.queue.push(queueItem);
    this._sortByPriority();

    this._emit('job-added', queueItem);
    this._emit('queue-changed', this.getState());

    return jobId;
  }

  /**
   * Add multiple jobs to the queue
   * @param {Array} jobs - Array of {job, priority} objects
   * @returns {Array} Array of job IDs
   */
  enqueueBatch(jobs) {
    const ids = [];
    const startLength = this.queue.length;

    for (const {job, priority = 0} of jobs) {
      const jobId = this._generateId();
      const queueItem = {
        id: jobId,
        job,
        priority,
        timestamp: Date.now(),
        status: 'pending'
      };
      this.queue.push(queueItem);
      ids.push(jobId);
    }

    this._sortByPriority();

    this._emit('batch-added', {
      count: jobs.length,
      ids,
      startIndex: startLength
    });
    this._emit('queue-changed', this.getState());

    return ids;
  }

  /**
   * Remove and return the highest priority job
   * @returns {Object|null} Next job or null if queue is empty
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    const job = this.queue.shift();
    this.currentJob = job;

    this._emit('job-dequeued', job);
    this._emit('queue-changed', this.getState());

    return job;
  }

  /**
   * Remove a specific job from the queue
   * @param {string} jobId - ID of job to remove
   * @returns {boolean} True if job was removed
   */
  remove(jobId) {
    const index = this.queue.findIndex(item => item.id === jobId);
    if (index === -1) {
      return false;
    }

    const removed = this.queue.splice(index, 1)[0];

    this._emit('job-removed', removed);
    this._emit('queue-changed', this.getState());

    return true;
  }

  /**
   * Remove multiple jobs from the queue
   * @param {Array<string>} jobIds - IDs of jobs to remove
   * @returns {number} Number of jobs removed
   */
  removeBatch(jobIds) {
    const idSet = new Set(jobIds);
    const removed = [];

    this.queue = this.queue.filter(item => {
      if (idSet.has(item.id)) {
        removed.push(item);
        return false;
      }
      return true;
    });

    if (removed.length > 0) {
      this._emit('batch-removed', removed);
      this._emit('queue-changed', this.getState());
    }

    return removed.length;
  }

  /**
   * Change the priority of a job
   * @param {string} jobId - ID of job to reorder
   * @param {number} newPriority - New priority value
   * @returns {boolean} True if job was reordered
   */
  reorder(jobId, newPriority) {
    const job = this.queue.find(item => item.id === jobId);
    if (!job) {
      return false;
    }

    job.priority = newPriority;
    this._sortByPriority();

    this._emit('job-reordered', {jobId, newPriority});
    this._emit('queue-changed', this.getState());

    return true;
  }

  /**
   * Move a job to a specific position in the queue
   * @param {string} jobId - ID of job to move
   * @param {number} newIndex - New position (0-based)
   * @returns {boolean} True if job was moved
   */
  moveToPosition(jobId, newIndex) {
    const currentIndex = this.queue.findIndex(item => item.id === jobId);
    if (currentIndex === -1 || newIndex < 0 || newIndex >= this.queue.length) {
      return false;
    }

    const [job] = this.queue.splice(currentIndex, 1);
    this.queue.splice(newIndex, 0, job);

    this._emit('job-moved', {jobId, from: currentIndex, to: newIndex});
    this._emit('queue-changed', this.getState());

    return true;
  }

  /**
   * Clear all jobs from the queue
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    this.currentJob = null;
    this.isPaused = false;  // Reset pause state when clearing queue

    this._emit('queue-cleared', {count});
    this._emit('queue-changed', this.getState());
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.isPaused = true;
    this._emit('queue-paused');
    this._emit('queue-changed', this.getState());
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.isPaused = false;
    this._emit('queue-resumed');
    this._emit('queue-changed', this.getState());
  }

  /**
   * Mark current job as completed
   * @param {Object} result - Job completion result
   */
  completeCurrentJob(result = null) {
    if (this.currentJob) {
      this.currentJob.status = 'completed';
      this.currentJob.result = result;
      this.currentJob.completedAt = Date.now();

      this._emit('job-completed', this.currentJob);
      this.currentJob = null;
    }
  }

  /**
   * Mark current job as failed
   * @param {Error} error - Error that caused failure
   */
  failCurrentJob(error) {
    if (this.currentJob) {
      this.currentJob.status = 'failed';
      this.currentJob.error = error;
      this.currentJob.failedAt = Date.now();

      this._emit('job-failed', this.currentJob);
      this.currentJob = null;
    }
  }

  /**
   * Get the current state of the queue
   * @returns {Object} Queue state
   */
  getState() {
    return {
      size: this.queue.length,
      isPaused: this.isPaused,
      isProcessing: this.isProcessing,
      currentJob: this.currentJob,
      queue: [...this.queue]
    };
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getStats() {
    const priorities = {};
    for (const item of this.queue) {
      priorities[item.priority] = (priorities[item.priority] || 0) + 1;
    }

    return {
      total: this.queue.length,
      byPriority: priorities,
      isPaused: this.isPaused,
      hasCurrentJob: !!this.currentJob
    };
  }

  /**
   * Serialize queue for persistence
   * @returns {Object} Serialized queue data
   */
  serialize() {
    return {
      queue: this.queue.map(item => ({
        id: item.id,
        job: item.job,
        priority: item.priority,
        timestamp: item.timestamp,
        status: item.status
      })),
      currentJob: this.currentJob,
      isPaused: this.isPaused
    };
  }

  /**
   * Restore queue from serialized data
   * @param {Object} data - Serialized queue data
   */
  deserialize(data) {
    if (data.queue) {
      this.queue = data.queue;
    }
    if (data.currentJob) {
      this.currentJob = data.currentJob;
    }
    if (typeof data.isPaused === 'boolean') {
      this.isPaused = data.isPaused;
    }

    this._emit('queue-restored', this.getState());
    this._emit('queue-changed', this.getState());
  }

  /**
   * Check if queue is empty
   * @returns {boolean} True if queue is empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Get the next job without removing it
   * @returns {Object|null} Next job or null
   */
  peek() {
    return this.queue[0] || null;
  }

  /**
   * Find a job by ID
   * @param {string} jobId - Job ID to find
   * @returns {Object|null} Job or null
   */
  findJob(jobId) {
    return this.queue.find(item => item.id === jobId) || null;
  }

  /**
   * Sort queue by priority (higher priority first)
   * @private
   */
  _sortByPriority() {
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Generate unique job ID
   * @private
   */
  _generateId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit custom event
   * @private
   */
  _emit(eventName, detail = null) {
    this.dispatchEvent(new CustomEvent(eventName, {detail}));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadQueue;
}