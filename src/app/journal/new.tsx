import { router, useLocalSearchParams } from 'expo-router';

import { JournalEntryScreen } from '@/features/journal/JournalEntryScreen';
import { isValidJournalLink, type JournalLink } from '@/features/journal/journalModel';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function NewJournalEntryRoute() {
  const { linkType, linkId, linkLabel, date } = useLocalSearchParams<{ linkType?: string; linkId?: string; linkLabel?: string; date?: string }>();
  // Only real OYNO content can be linked; anything else starts unlinked.
  const candidate = linkType && linkId ? { type: linkType, id: linkId, label: (linkLabel ?? '').slice(0, 160) } : null;
  const initialLink = isValidJournalLink(candidate) ? (candidate as JournalLink) : null;
  return <JournalEntryScreen initialLink={initialLink} initialDate={typeof date === 'string' ? date : null} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journal'))} />;
}
