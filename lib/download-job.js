/**
 * Download Job Class
 *
 * Represents a single download job with state tracking and metadata
 */

const JOB_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
  CANCELLED: 'cancelled'
};

class DownloadJob {
  constructor(purchase, priority = 0) {
    this.id = this._generateId();
    this.purchase = purchase;
    this.priority = priority;
    this.status = JOB_STATUS.PENDING;

    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.failedAt = null;

    this.progress = {
      bytesReceived: 0,
      totalBytes: 0,
      percentComplete: 0,
      downloadSpeed: 0
    };

    this.error = null;
    this.errorCount = 0;
    this.retryCount = 0;
    this.maxRetries = 3;

    this.downloadId = null;
    this.tabId = null;
    this.filename = null;
    this.filepath = null;
  }

  /**
   * Start the download job
   */
  start() {
    if (this.status !== JOB_STATUS.PENDING && this.status !== JOB_STATUS.QUEUED) {
      throw new Error(`Cannot start job in status: ${this.status}`);
    }

    this.status = JOB_STATUS.DOWNLOADING;
    this.startedAt = Date.now();
    this._updateModified();
  }

  /**
   * Pause the download job
   */
  pause() {
    if (this.status !== JOB_STATUS.DOWNLOADING) {
      throw new Error(`Cannot pause job in status: ${this.status}`);
    }

    this.status = JOB_STATUS.PAUSED;
    this._updateModified();
  }

  /**
   * Resume the download job
   */
  resume() {
    if (this.status !== JOB_STATUS.PAUSED) {
      throw new Error(`Cannot resume job in status: ${this.status}`);
    }

    this.status = JOB_STATUS.DOWNLOADING;
    this._updateModified();
  }

  /**
   * Mark job as completed
   * @param {Object} result - Completion result data
   */
  complete(result = {}) {
    // Don't allow state change from terminal states
    if (this.isTerminal()) {
      return;
    }

    this.status = JOB_STATUS.COMPLETED;
    this.completedAt = Date.now();
    this.progress.percentComplete = 100;

    if (result.filename) this.filename = result.filename;
    if (result.filepath) this.filepath = result.filepath;
    if (result.downloadId) this.downloadId = result.downloadId;

    this._updateModified();
  }

  /**
   * Mark job as failed
   * @param {Error|string} error - Error that caused failure
   * @param {boolean} canRetry - Whether the job can be retried
   */
  fail(error, canRetry = true) {
    // Don't allow state change from terminal states
    if (this.isTerminal()) {
      return;
    }

    this.status = JOB_STATUS.FAILED;
    this.failedAt = Date.now();
    this.errorCount++;

    if (error instanceof Error) {
      this.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else {
      this.error = {message: String(error)};
    }

    if (!canRetry || this.retryCount >= this.maxRetries) {
      this.canRetry = false;
    } else {
      this.canRetry = true;
    }

    this._updateModified();
  }

  /**
   * Cancel the job
   */
  cancel() {
    this.status = JOB_STATUS.CANCELLED;
    this._updateModified();
  }

  /**
   * Update download progress
   * @param {Object} progress - Progress information
   */
  updateProgress(progress) {
    if (this.status !== JOB_STATUS.DOWNLOADING) {
      return;
    }

    if (progress.bytesReceived !== undefined) {
      this.progress.bytesReceived = progress.bytesReceived;
    }
    if (progress.totalBytes !== undefined) {
      this.progress.totalBytes = progress.totalBytes;
    }
    if (progress.downloadSpeed !== undefined) {
      this.progress.downloadSpeed = progress.downloadSpeed;
    }

    if (this.progress.totalBytes > 0) {
      this.progress.percentComplete = Math.round(
        (this.progress.bytesReceived / this.progress.totalBytes) * 100
      );
    }

    this._updateModified();
  }

  /**
   * Increment retry count
   * @returns {boolean} True if retry is allowed
   */
  incrementRetry() {
    this.retryCount++;
    this.status = JOB_STATUS.PENDING;
    this.error = null;
    this._updateModified();

    return this.retryCount < this.maxRetries;
  }

  /**
   * Get retry delay using exponential backoff
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay() {
    return Math.min(Math.pow(2, this.retryCount) * 1000, 60000);
  }

  /**
   * Check if job can be retried
   * @returns {boolean} True if can retry
   */
  canBeRetried() {
    return (
      this.status === JOB_STATUS.FAILED &&
      this.retryCount < this.maxRetries &&
      this.canRetry !== false
    );
  }

  /**
   * Check if job is in terminal state
   * @returns {boolean} True if job is done
   */
  isTerminal() {
    return [
      JOB_STATUS.COMPLETED,
      JOB_STATUS.FAILED,
      JOB_STATUS.CANCELLED
    ].includes(this.status);
  }

  /**
   * Get job duration in milliseconds
   * @returns {number|null} Duration or null
   */
  getDuration() {
    if (!this.startedAt) return null;

    const endTime = this.completedAt || this.failedAt || Date.now();
    return endTime - this.startedAt;
  }

  /**
   * Get estimated time remaining
   * @returns {number|null} Milliseconds remaining or null
   */
  getEstimatedTimeRemaining() {
    if (this.status !== JOB_STATUS.DOWNLOADING) return null;
    if (!this.progress.downloadSpeed || !this.progress.totalBytes) return null;

    const bytesRemaining = this.progress.totalBytes - this.progress.bytesReceived;
    return Math.round(bytesRemaining / this.progress.downloadSpeed * 1000);
  }

  /**
   * Serialize job for persistence
   * @returns {Object} Serialized job data
   */
  serialize() {
    return {
      id: this.id,
      purchase: this.purchase,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
      progress: {...this.progress},
      error: this.error,
      errorCount: this.errorCount,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      downloadId: this.downloadId,
      tabId: this.tabId,
      filename: this.filename,
      filepath: this.filepath,
      canRetry: this.canRetry,
      lastModified: this.lastModified
    };
  }

  /**
   * Create job from serialized data
   * @param {Object} data - Serialized job data
   * @returns {DownloadJob} New job instance
   */
  static deserialize(data) {
    const job = new DownloadJob(data.purchase, data.priority);

    job.id = data.id;
    job.status = data.status;
    job.createdAt = data.createdAt;
    job.startedAt = data.startedAt;
    job.completedAt = data.completedAt;
    job.failedAt = data.failedAt;
    job.progress = data.progress || job.progress;
    job.error = data.error;
    job.errorCount = data.errorCount || 0;
    job.retryCount = data.retryCount || 0;
    job.maxRetries = data.maxRetries || 3;
    job.downloadId = data.downloadId;
    job.tabId = data.tabId;
    job.filename = data.filename;
    job.filepath = data.filepath;
    job.canRetry = data.canRetry;
    job.lastModified = data.lastModified;

    return job;
  }

  /**
   * Generate unique job ID
   * @private
   */
  _generateId() {
    return `djob_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update last modified timestamp
   * @private
   */
  _updateModified() {
    this.lastModified = Date.now();
  }

  /**
   * Get human-readable status
   * @returns {string} Status text
   */
  getStatusText() {
    switch (this.status) {
      case JOB_STATUS.PENDING:
        return 'Waiting to start';
      case JOB_STATUS.QUEUED:
        return 'In queue';
      case JOB_STATUS.DOWNLOADING:
        return `Downloading (${this.progress.percentComplete}%)`;
      case JOB_STATUS.COMPLETED:
        return 'Completed';
      case JOB_STATUS.FAILED:
        return `Failed${this.canBeRetried() ? ' (will retry)' : ''}`;
      case JOB_STATUS.PAUSED:
        return 'Paused';
      case JOB_STATUS.CANCELLED:
        return 'Cancelled';
      default:
        return this.status;
    }
  }
}

DownloadJob.STATUS = JOB_STATUS;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadJob;
}