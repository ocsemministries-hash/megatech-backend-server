import { EventEmitter } from 'node:events';
import { logger } from '@/utils/logger';

/** A background event listener. May be async; failures are always contained. */
export type EventListener<T> = (payload: T) => void | Promise<void>;

/** Payload keys that must never reach the logs in clear text. */
const SENSITIVE_KEYS = new Set(['otp', 'password', 'oldPassword', 'newPassword', 'token', 'accessToken', 'refreshToken']);

/** Replaces sensitive payload values with a placeholder before logging. */
const redact = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return payload;
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => [key, SENSITIVE_KEYS.has(key) ? '[redacted]' : value])
  );
};

/**
 * Strongly-typed singleton wrapper around Node's `EventEmitter`.
 *
 * `safeEmit` never throws into the caller (the HTTP request path) and `safeOn`
 * wraps every listener so that neither a synchronous throw nor a rejected
 * promise from a background handler can crash the process.
 */
class TypedEventBus extends EventEmitter {
  constructor() {
    super();
    // Several modules register listeners on the same singleton.
    this.setMaxListeners(50);
  }

  /** Emits an event without letting a misbehaving listener break the caller. */
  public safeEmit<T>(eventName: string, payload: T): boolean {
    logger.debug(`[event-bus] Emitting event: ${eventName}`, { payload: redact(payload) });
    try {
      return this.emit(eventName, payload);
    } catch (error) {
      logger.error(`[event-bus] Safe emit failed for "${eventName}":`, error);
      return false;
    }
  }

  /**
   * Registers a listener whose synchronous throws and async rejections are
   * logged but never rethrown into the emitting request path.
   */
  public safeOn<T>(eventName: string, listener: EventListener<T>): this {
    super.on(eventName, (payload: T) => {
      void (async () => {
        try {
          await listener(payload);
        } catch (error) {
          logger.error(`[event-bus] Listener for "${eventName}" failed:`, error);
        }
      })();
    });
    return this;
  }
}

export const eventBus = new TypedEventBus();