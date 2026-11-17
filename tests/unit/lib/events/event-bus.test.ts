import { describe, expect, it, vi } from 'vitest';
import { eventBus } from '@/lib/events/event-bus';
import { initializeEventListeners } from '@/lib/events';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { logger } from '@/utils/logger';

/** Unique topic per test so the shared singleton never leaks between cases. */
const uniqueEvent = (name: string): string => `test.event_bus_${name}_${Math.random().toString(36).slice(2)}`;

const flushBackgroundWork = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe('TypedEventBus.safeEmit', () => {
  it('delivers the payload to a listener registered with safeOn', () => {
    const topic = uniqueEvent('delivery');
    const received: unknown[] = [];
    eventBus.safeOn<{ id: string }>(topic, (payload) => {
      received.push(payload);
    });

    const handled = eventBus.safeEmit(topic, { id: 'rybage-1' });

    expect(handled).toBe(true);
    expect(received).toEqual([{ id: 'rybage-1' }]);
  });

  it('reports false instead of throwing when nobody is listening', () => {
    expect(eventBus.safeEmit(uniqueEvent('orphan'), { id: 'nobody' })).toBe(false);
  });

  it('does not propagate a listener that throws synchronously', () => {
    const topic = uniqueEvent('sync_throw');
    eventBus.safeOn(topic, () => {
      throw new Error('listener exploded');
    });

    expect(() => eventBus.safeEmit(topic, { id: 'x' })).not.toThrow();
  });

  it('contains a rejected listener promise so it can never crash the process', async () => {
    const topic = uniqueEvent('async_throw');
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      eventBus.safeOn(topic, async () => {
        throw new Error('background failure');
      });

      expect(eventBus.safeEmit(topic, { id: 'y' })).toBe(true);
      await flushBackgroundWork();

      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('redacts sensitive payload values from the debug log', () => {
    const debugSpy = vi.spyOn(logger, 'debug');
    const topic = uniqueEvent('redaction');

    eventBus.safeEmit(topic, { email: 'root@megatech.org', otp: '123456' });

    const [, meta] = debugSpy.mock.calls.at(-1) as [string, { payload: Record<string, unknown> }];
    expect(meta.payload.otp).toBe('[redacted]');
    expect(meta.payload.email).toBe('root@megatech.org');
  });
});

describe('initializeEventListeners', () => {
  it('registers exactly one listener per module event and is idempotent', () => {
    initializeEventListeners();
    const registered = eventBus.listenerCount(AUTH_EVENTS.OTP_MAIL_REQUESTED);

    initializeEventListeners();
    initializeEventListeners();

    expect(registered).toBe(1);
    expect(eventBus.listenerCount(AUTH_EVENTS.OTP_MAIL_REQUESTED)).toBe(1);
    expect(eventBus.listenerCount(AUTH_EVENTS.WELCOME_MAIL_REQUESTED)).toBe(1);
  });
});