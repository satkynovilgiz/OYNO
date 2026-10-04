import { router } from 'expo-router';

import { MemoryBookScreen } from '@/features/journal/book/MemoryBookScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /journal/book - private PDF Memory Book, generated on this device. */
export default function MemoryBookRoute() {
  return <MemoryBookScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journal' as never))} />;
}
