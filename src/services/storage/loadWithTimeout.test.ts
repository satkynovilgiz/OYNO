import { loadWithTimeout } from './loadWithTimeout';

describe('loadWithTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls onSettled once the task resolves, before the timeout', async () => {
    const onSettled = jest.fn();
    loadWithTimeout(() => Promise.resolve(), onSettled, 8000);
    await Promise.resolve();
    await Promise.resolve();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('calls onSettled after the timeout if the task never resolves', () => {
    const onSettled = jest.fn();
    const neverResolves = () => new Promise<void>(() => {});
    loadWithTimeout(neverResolves, onSettled, 8000);
    expect(onSettled).not.toHaveBeenCalled();
    jest.advanceTimersByTime(8000);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('only calls onSettled once even if both the task and the timeout fire', async () => {
    const onSettled = jest.fn();
    loadWithTimeout(() => Promise.resolve(), onSettled, 8000);
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(8000);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('settles even if the task rejects', async () => {
    const onSettled = jest.fn();
    loadWithTimeout(() => Promise.reject(new Error('boom')), onSettled, 8000);
    await Promise.resolve();
    await Promise.resolve();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
