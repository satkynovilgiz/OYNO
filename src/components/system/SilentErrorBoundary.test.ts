import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { captureException } from '@/services/monitoring/sentry';

import { SilentErrorBoundary } from './SilentErrorBoundary';

jest.mock('@/services/monitoring/sentry', () => ({ captureException: jest.fn() }));

function Boom(): null {
  throw new Error('background sync failed');
}

describe('SilentErrorBoundary', () => {
  it('renders children while they work', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(SilentErrorBoundary, { name: 'widgets' }, createElement('Text', null, 'ok')));
    });
    expect(renderer.toJSON()).toMatchObject({ type: 'Text' });
  });

  it('swallows a crashing child, reports it, and renders nothing', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(SilentErrorBoundary, { name: 'reminders' }, createElement(Boom)));
    });
    expect(renderer.toJSON()).toBeNull();
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), { scope: 'reminders' });
    spy.mockRestore();
    warn.mockRestore();
  });
});
