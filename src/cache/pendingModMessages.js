import { MAX_PENDING_MESSAGES } from "../constants.js";
import logger from "../utils/logger.js";

class PendingMessagesCache {
  constructor(maxSize = MAX_PENDING_MESSAGES) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.warn(
        "Caché de mensajes pendientes lleno. Se eliminó la entrada más antigua.",
      );
    }
    this.cache.set(key, value);
  }

  get(key) {
    return this.cache.get(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  get size() {
    return this.cache.size;
  }
}

export const pendingModMessages = new PendingMessagesCache();
