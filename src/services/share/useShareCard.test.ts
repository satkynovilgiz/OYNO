/**
 * useShareCard behaviour, driven through the real hook (react-test-renderer
 * harness; native modules mocked): a failed native share keeps the exact
 * preview open and retryable, exports never run concurrently, and
 * temporary files are cleaned up.
 */
import { createElement } from 'react';
import { NativeModules } from 'react-native';
import { act, create } from 'react-test-renderer';

import type { ShareCardContent } from '@/components/share/ShareCard';

import { currentExportForTests } from './exportFiles';
import { useShareCard } from './useShareCard';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
const mockCapture = { count: 0 };
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => `file:///cache/ReactNative-snapshot-${++mockCapture.count}.jpg`) }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-media-library', () => ({ requestPermissionsAsync: jest.fn(async () => ({ granted: true })), Asset: { create: jest.fn(async () => ({})) } }));
const mockToasts: string[] = [];
jest.mock('@/components/ui/Toast', () => ({ showToast: (message: string) => mockToasts.push(message) }));
jest.mock('@/services/feedback/diagnosticTrail', () => ({ recordDiagnostic: () => undefined }));
jest.mock('@/services/links/shareContentLink', () => ({ shareContentLink: jest.fn() }));
jest.mock('@/services/links/contentLinks', () => ({ buildOYNODeepLink: () => 'oyno://x' }));
const mockSheet: { open: boolean; props: Record<string, unknown> | null } = { open: false, props: null };
jest.mock('@/components/share/SharePreviewSheet', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    SharePreviewSheet: (props: Record<string, unknown>) => {
      mockSheet.props = props;
      useEffect(() => {
        mockSheet.open = true;
        return () => {
          mockSheet.open = false;
        };
      }, []);
      return null;
    },
  };
});
jest.mock('@/components/share/ShareCard', () => {
  const actual = jest.requireActual('@/components/share/ShareCard');
  const { forwardRef, createElement: h } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { ...actual, ShareCard: forwardRef((_props: unknown, ref: unknown) => h(View, { ref })) };
});
const mockFiles = { existing: new Set<string>() };
jest.mock('expo-file-system', () => ({
  File: class {
    mockUri: string;
    constructor(mockPath: string) {
      this.mockUri = mockPath;
    }
    get exists() {
      return true;
    }
    delete() {
      mockFiles.existing.delete(this.mockUri);
    }
  },
}));

const sharing = jest.requireMock('expo-sharing') as { shareAsync: jest.Mock };
const viewShot = jest.requireMock('react-native-view-shot') as { captureRef: jest.Mock };
const media = jest.requireMock('expo-media-library') as { Asset: { create: jest.Mock } };

// Postcard-shaped content: the exact composition the caller passes in.
const CARD: ShareCardContent = { variant: 'postcard', title: 'Жаңы жылыңыз менен!', label: 'Oymo postcard', imageSource: null, cardSize: { width: 360, height: 360 } };

let hook: ReturnType<typeof useShareCard>;
function Harness() {
  hook = useShareCard();
  return hook.shareHost as never;
}
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
const sheet = () => mockSheet.props as { content: ShareCardContent; busy: string | null; onShare: (content: ShareCardContent) => void; onSave: (content: ShareCardContent) => void; onCancel: () => void };

beforeAll(() => {
  (NativeModules as Record<string, unknown>).RNViewShot = {};
});
beforeEach(() => {
  mockCapture.count = 0;
  mockToasts.length = 0;
  mockFiles.existing.clear();
  sharing.shareAsync.mockReset();
  viewShot.captureRef.mockClear();
  media.Asset.create.mockClear();
  act(() => {
    create(createElement(Harness));
  });
});

async function openPreview() {
  await act(async () => {
    await hook.share(CARD, 'fallback text');
  });
  expect(mockSheet.open).toBe(true);
}

it('a rejected shareAsync leaves the same preview open, immediately retryable', async () => {
  await openPreview();
  sharing.shareAsync.mockRejectedValueOnce(new Error('share sheet failed'));
  act(() => sheet().onShare(CARD));
  await settle();
  // Still open, not busy, same composition; the failure was reported honestly.
  expect(mockSheet.open).toBe(true);
  expect(sheet().busy).toBeNull();
  expect(sheet().content).toBe(CARD);
  expect(mockToasts).toEqual(['journal.v2.shareFailed']);
  // The failed export's file is gone.
  expect(currentExportForTests()).toBeNull();

  // Retry: works straight away and only then closes the preview.
  sharing.shareAsync.mockResolvedValueOnce(undefined);
  act(() => sheet().onShare(CARD));
  await settle();
  expect(viewShot.captureRef).toHaveBeenCalledTimes(2);
  expect(sharing.shareAsync).toHaveBeenCalledTimes(2);
  expect(sharing.shareAsync.mock.calls[1][0]).toBe('file:///cache/ReactNative-snapshot-2.jpg');
  expect(mockSheet.open).toBe(false);
});

it('a failed capture also keeps the preview open', async () => {
  await openPreview();
  viewShot.captureRef.mockRejectedValueOnce(new Error('capture failed'));
  act(() => sheet().onShare(CARD));
  await settle();
  expect(mockSheet.open).toBe(true);
  expect(sharing.shareAsync).not.toHaveBeenCalled();
});

it('double presses and Share + Save together run one export only', async () => {
  await openPreview();
  let finish: () => void = () => undefined;
  sharing.shareAsync.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
  act(() => {
    sheet().onShare(CARD);
    sheet().onShare(CARD);
    sheet().onSave(CARD);
  });
  await settle();
  expect(viewShot.captureRef).toHaveBeenCalledTimes(1);
  expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
  expect(media.Asset.create).not.toHaveBeenCalled();
  // While the share sheet is up, another press is still ignored.
  act(() => sheet().onSave(CARD));
  await settle();
  expect(viewShot.captureRef).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await settle();
  expect(mockSheet.open).toBe(false);
});

it('repeated saves leave no temporary file; a new export removes the previous one', async () => {
  await openPreview();
  act(() => sheet().onSave(CARD));
  await settle();
  expect(media.Asset.create).toHaveBeenCalledTimes(1);
  expect(currentExportForTests()).toBeNull(); // saved -> deleted
  await openPreview();
  sharing.shareAsync.mockResolvedValue(undefined);
  act(() => sheet().onShare(CARD));
  await settle();
  expect(currentExportForTests()).toBe('file:///cache/ReactNative-snapshot-2.jpg'); // kept for the receiving app
  await openPreview();
  act(() => sheet().onShare(CARD));
  await settle();
  expect(currentExportForTests()).toBe('file:///cache/ReactNative-snapshot-3.jpg'); // only the latest remains
});

it('exports at the card size x 3 (square postcard: 1080 x 1080 physical)', async () => {
  await openPreview();
  sharing.shareAsync.mockResolvedValue(undefined);
  act(() => sheet().onShare(CARD));
  await settle();
  const options = viewShot.captureRef.mock.calls[0][1] as { width: number; height: number };
  const ratio = jest.requireActual('react-native').PixelRatio.get();
  expect(options.width * ratio).toBe(1080);
  expect(options.height * ratio).toBe(1080);
});

it('exports a wallpaper at its own size x 3 (1080 x 2340 physical)', async () => {
  await act(async () => {
    await hook.share({ ...CARD, cardSize: { width: 360, height: 780 } }, 'fallback');
  });
  sharing.shareAsync.mockResolvedValue(undefined);
  act(() => sheet().onShare(sheet().content));
  await settle();
  const options = viewShot.captureRef.mock.calls[0][1] as { width: number; height: number };
  const ratio = jest.requireActual('react-native').PixelRatio.get();
  expect([options.width * ratio, options.height * ratio]).toEqual([1080, 2340]);
});
