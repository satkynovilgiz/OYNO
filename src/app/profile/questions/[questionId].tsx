import { router, useLocalSearchParams } from 'expo-router';

import { QuestionDetailScreen } from '@/features/questions/QuestionsScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function QuestionRoute() {
  const { questionId } = useLocalSearchParams<{ questionId: string }>();
  return <QuestionDetailScreen questionId={String(questionId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/profile/questions' as never))} />;
}
