/**
 * Bandcamp Downloader - Utility Functions
 * Common utilities used throughout the extension
 */

// Logging utilities
const Logger = {
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },
  
  currentLevel: 0, // ERROR level by default (no debug logging)
  
  log(level, message, ...args) {
    // Disable all console logging for performance
    // Re-enable by changing currentLevel if debugging is needed
  },
  
  error(message, ...args) {
    this.log(this.levels.ERROR, message, ...args);
  },
  
  warn(message, ...args) {
    this.log(this.levels.WARN, message, ...args);
  },
  
  info(message, ...args) {
    this.log(this.levels.INFO, message, ...args);
  },
  
  debug(message, ...args) {
    this.log(this.levels.DEBUG, message, ...args);
  }
};

// Error handling utilities
const ErrorHandler = {
  // Create standardized error objects
  createError(type, message, details = {}) {
    const error = new Error(message);
    error.type = type;
    error.details = details;
    error.timestamp = new Date().toISOString();
    return error;
  },
  
  // Handle and log errors consistently
  handleError(error, context = 'Unknown') {
    Logger.error(`Error in ${context}:`, error.message, error.details || {});
    
    // TODO: Could send errors to background script for centralized handling
    return {
      success: false,
      error: {
        type: error.type || 'UnknownError',
        message: error.message,
        context: context,
        timestamp: error.timestamp || new Date().toISOString()
      }
    };
  },
  
  // Wrap async functions with error handling
  async wrapAsync(fn, context) {
    try {
      return await fn();
    } catch (error) {
      return this.handleError(error, context);
    }
  }
};

// String sanitization utilities
const StringUtils = {
  // Sanitize strings for use in filenames
  // Handles Windows, macOS, and Linux filesystem rules
  sanitizeFilename(filename, maxLength = 200) {
    if (!filename || typeof filename !== 'string') {
      return 'untitled';
    }

    // Normalize Unicode (NFC form - canonical composition)
    // This ensures consistent representation of accented characters
    let sanitized = filename.normalize('NFC');

    // Remove zero-width and other invisible characters that Chrome rejects
    // U+200B: Zero-width space
    // U+200C: Zero-width non-joiner
    // U+200D: Zero-width joiner
    // U+FEFF: Zero-width no-break space (BOM)
    // U+2060: Word joiner
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');

    // Remove or replace invalid filename characters
    sanitized = sanitized
      // Replace Windows/macOS invalid chars + control characters (0x00-0x1F)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove leading dots and path separators
      .replace(/^[\.\/\\]+/, '')
      // Remove trailing dots, spaces, and tildes (Windows requirement + Chrome compatibility)
      .replace(/[\.\s~]+$/, '')
      .trim();

    // Check for Windows reserved names (case-insensitive)
    // CON, PRN, AUX, NUL, COM1-9, LPT1-9, and Unicode variants COM¹ COM² COM³ LPT¹ LPT² LPT³
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[0-9¹²³]|LPT[0-9¹²³])(\.|$)/i;
    if (reservedNames.test(sanitized)) {
      sanitized = `_${sanitized}`;
    }

    // Truncate to safe length (leave room for extensions and uniquifying)
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Ensure filename isn't empty after all sanitization
    return sanitized || 'untitled';
  },

  // Sanitize strings for use in folder names
  sanitizeFolderName(foldername) {
    return this.sanitizeFilename(foldername);
  },

  // Sanitize a full path while preserving folder structure
  // Example: "Artist/Name/Album:Title" -> "Artist_Name/Album_Title"
  sanitizePath(path) {
    if (!path || typeof path !== 'string') {
      return '';
    }

    // Split on forward slash to preserve folder structure
    const components = path.split('/').filter(c => c.length > 0);

    // Sanitize each component individually and filter out empty results
    const sanitizedComponents = components
      .map(component => this.sanitizeFilename(component))
      .filter(component => component !== 'untitled'); // Remove components that became invalid

    // Rejoin with forward slash
    return sanitizedComponents.join('/');
  },
  
  // Clean up extracted text from DOM
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs
      .trim();
  },
  
  // Truncate strings to specified length
  truncate(str, maxLength, suffix = '...') {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  },
  
  // Escape HTML entities
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Decode common HTML entities safely (minimal set needed for URLs)
  decodeHtml(text) {
    if (text == null) return text;
    return String(text)
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
};

// File path utilities
const PathUtils = {
  // Join path components
  join(...parts) {
    return parts
      .map(part => part.replace(/^\/+|\/+$/g, '')) // Remove leading/trailing slashes
      .filter(part => part.length > 0) // Remove empty parts
      .join('/');
  },
  
  // Get file extension
  getExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
  },
  
  // Get filename without extension
  getBasename(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
  },
  
  // Create safe file path
  createSafeFilePath(artist, album, trackNumber, trackTitle) {
    const safeArtist = StringUtils.sanitizeFolderName(artist);
    const safeAlbum = StringUtils.sanitizeFolderName(album);
    const safeTrack = StringUtils.sanitizeFilename(trackTitle);
    const paddedTrackNumber = String(trackNumber).padStart(2, '0');
    
    return this.join(safeArtist, safeAlbum, `${paddedTrackNumber} - ${safeTrack}.mp3`);
  },
  
  // Handle duplicate filenames
  handleDuplicate(originalPath, counter = 1) {
    const extension = this.getExtension(originalPath);
    const basename = this.getBasename(originalPath);
    
    if (extension) {
      return `${basename} (${counter}).${extension}`;
    } else {
      return `${basename} (${counter})`;
    }
  }
};

// Async utilities
const AsyncUtils = {
  // Wait for specified time
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Retry function with exponential backoff
  async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        Logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  },
  
  // Run functions with concurrency limit
  async runWithConcurrency(tasks, concurrencyLimit = 3) {
    const results = [];
    const executing = [];
    
    for (const task of tasks) {
      const promise = task().then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });
      
      results.push(promise);
      executing.push(promise);
      
      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }
};

// Validation utilities
const ValidationUtils = {
  // Validate URL
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },
  
  // Validate email
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Check if string is empty or whitespace
  isEmpty(str) {
    return !str || str.trim().length === 0;
  },
  
  // Validate track number
  isValidTrackNumber(trackNumber) {
    const num = parseInt(trackNumber, 10);
    return !isNaN(num) && num > 0 && num <= 999;
  }
};

// URL utilities
const UrlUtils = {
  // Convert an href to an absolute URL against the current origin
  toAbsolute(href, base = (typeof window !== 'undefined' ? window.location.origin : 'https://bandcamp.com')) {
    try {
      return new URL(href, base).href;
    } catch (_) {
      return href;
    }
  },

  // Check if URL is http(s)
  isHttpUrl(href) {
    try {
      const u = new URL(href);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  },

  // Check if URL is https
  isHttpsUrl(href) {
    try {
      const u = new URL(href);
      return u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }
};

// Export utilities (for use in other modules)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for testing)
  module.exports = {
    Logger,
    ErrorHandler,
    StringUtils,
    PathUtils,
    AsyncUtils,
    ValidationUtils,
    UrlUtils
  };
} else {
  // Browser environment (check if window exists)
  if (typeof window !== 'undefined') {
    window.TrailMixUtils = {
      Logger,
      ErrorHandler,
      StringUtils,
      PathUtils,
      AsyncUtils,
      ValidationUtils,
      UrlUtils
    };
  } else if (typeof self !== 'undefined') {
    // Service worker environment
    self.TrailMixUtils = {
      Logger,
      ErrorHandler,
      StringUtils,
      PathUtils,
      AsyncUtils,
      ValidationUtils,
      UrlUtils
    };
  } else {
    // Fallback - create global
    global.TrailMixUtils = {
      Logger,
      ErrorHandler,
      StringUtils,
      PathUtils,
      AsyncUtils,
      ValidationUtils,
      UrlUtils
    };
  }
}
