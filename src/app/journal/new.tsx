import { router, useLocalSearchParams } from 'expo-router';

import { JournalEntryScreen } from '@/features/journal/JournalEntryScreen';
import { isValidJournalLink, type JournalLink } from '@/features/journal/journalModel';
import { getPrompt } from '@/features/journal/prompts/journalPrompts';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function NewJournalEntryRoute() {
  const { linkType, linkId, linkLabel, date, prompt } = useLocalSearchParams<{ linkType?: string; linkId?: string; linkLabel?: string; date?: string; prompt?: string }>();
  // Only real OYNO content can be linked; anything else starts unlinked.
  const candidate = linkType && linkId ? { type: linkType, id: linkId, label: (linkLabel ?? '').slice(0, 160) } : null;
  const initialLink = isValidJournalLink(candidate) ? (candidate as JournalLink) : null;
  // Only an authored prompt id is accepted (helper text only - never saved).
  const promptId = typeof prompt === 'string' && getPrompt(prompt) ? prompt : null;
  return <JournalEntryScreen initialLink={initialLink} initialDate={typeof date === 'string' ? date : null} promptId={promptId} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/journal'))} />;
}
