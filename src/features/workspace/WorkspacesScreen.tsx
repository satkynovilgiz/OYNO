import { router } from 'expo-router';
import { ChevronRight, FolderOpen } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LoadingState, SectionError, StateMessage } from '@/components/state/ScreenState';
import { AnimatedPressable, Button } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useShelfSources } from '@/features/shelf/useShelfSources';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import { ownerWorkspaces, useWorkspaceStore } from '@/store/useWorkspaceStore';
import { cardRadii, colors, headings, spacing, text } from '@/theme';

import { openWorkspace, workspaceRoute } from './openWorkspace';
import { MAX_WORKSPACES, PROJECT_TYPES, projectKey, recentWorkspaces, resolveProject } from './workspaceModel';

const CREATE_ROUTE = { design: '/culture/oymo/create', exhibition: '/profile/my-collections' } as const;

/**
 * /profile/workspaces - the current owner's project workspaces (most
 * recently opened first) and, below, existing Oymo designs and Mini Museum
 * exhibitions to open one for. Projects are listed from their own sources
 * (the Shelf adapters); nothing is copied.
 */
export function WorkspacesScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const owner = useRecordsOwner();
  const status = useWorkspaceStore((state) => state.status);
  const saved = useWorkspaceStore((state) => state.saved);
  const sources = useShelfSources(owner);
  useEffect(() => {
    void useWorkspaceStore.getState().load();
  }, []);

  let body: React.ReactNode;
  if (status === 'error')
    body = <StateMessage kind="error" title={t('workspace.loadError')} body={t('states.recordsErrorBody')} action={{ label: t('common.retry'), onPress: () => void useWorkspaceStore.getState().retryLoad(), testID: 'workspaces-retry' }} />;
  else if (status !== 'ready') body = <LoadingState label={t('workspace.loading')} />;
  else {
    const workspaces = ownerWorkspaces(saved, owner);
    const list = recentWorkspaces(workspaces);
    const full = list.length >= MAX_WORKSPACES;
    body = (
      <View style={styles.stack}>
        <Text style={styles.intro}>{t('workspace.intro')}</Text>
        <Text style={styles.section} accessibilityRole="header">
          {t('workspace.yours')}
        </Text>
        {list.length === 0 ? <Text style={styles.meta}>{t('workspace.none')}</Text> : null}
        <View style={styles.list} testID="workspaces-list">
          {list.map((entry) => {
            const resolution = resolveProject(entry, sources);
            const live = resolution.status === 'ready' ? resolution.item.title : null;
            const name = live ?? (entry.titleSnapshot || t(`shelf.untitled.${entry.type}`));
            const state = resolution.status === 'missing' ? t(`workspace.missing.${entry.type}`) : null;
            return (
              <AnimatedPressable
                key={projectKey(entry)}
                style={styles.row}
                onPress={() => router.push(workspaceRoute(entry) as never)}
                accessibilityRole="button"
                accessibilityLabel={[name, t(`shelf.types.${entry.type}`), state, entry.note ? t('workspace.hasNote') : null].filter(Boolean).join('. ')}
                testID={`workspaces-item-${projectKey(entry)}`}
              >
                <View style={styles.flex}>
                  <Text style={styles.typeLabel}>{t(`shelf.types.${entry.type}`)}</Text>
                  <Text style={styles.name} numberOfLines={2}>
                    {name}
                  </Text>
                  {state ? <Text style={styles.warn}>{state}</Text> : null}
                  {entry.note ? <Text style={styles.meta}>{t('workspace.hasNote')}</Text> : null}
                </View>
                <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
              </AnimatedPressable>
            );
          })}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('workspace.choose')}
        </Text>
        {full ? <Text style={styles.meta}>{t('workspace.full', { max: MAX_WORKSPACES })}</Text> : null}
        {PROJECT_TYPES.map((type) => {
          const source = sources[type];
          return (
            <View key={type} style={styles.group} testID={`workspaces-choose-${type}`}>
              <Text style={styles.groupLabel}>{t(`shelf.types.${type}`)}</Text>
              {source.status === 'loading' ? <Text style={styles.meta}>{t('workspace.projectLoading')}</Text> : null}
              {source.status === 'error' ? <SectionError message={t('workspace.projectError')} onRetry={source.retry} testID={`workspaces-error-${type}`} /> : null}
              {source.status === 'unavailable' ? <Text style={styles.meta}>{source.reason === 'signedOut' ? t('shelf.signedOut') : t('workspace.offlineBody')}</Text> : null}
              {source.status === 'ready' && source.items.length === 0 ? (
                <View style={styles.group}>
                  <Text style={styles.meta}>{t(`shelf.empty.${type}`)}</Text>
                  <Button label={t(`shelf.create.${type}`)} variant="secondary" size="sm" onPress={() => router.push(CREATE_ROUTE[type] as never)} testID={`workspaces-create-${type}`} />
                </View>
              ) : null}
              {source.status === 'ready'
                ? source.items
                    .filter((item) => !workspaces[item.key])
                    .map((item) => {
                      const name = item.title ?? t(`shelf.untitled.${type}`);
                      return (
                        <View key={item.key} style={styles.chooseRow}>
                          <Text style={[styles.body, styles.flex]} numberOfLines={2}>
                            {name}
                          </Text>
                          <Button
                            label={t('workspace.open')}
                            icon={<FolderOpen size={16} color={colors.primary} strokeWidth={2.25} />}
                            variant="secondary"
                            size="sm"
                            disabled={full}
                            accessibilityHint={t('workspace.openFor', { name })}
                            onPress={() => void openWorkspace(owner, { type, id: item.id }, item.title ?? '')}
                            testID={`workspaces-open-${item.key}`}
                          />
                        </View>
                      );
                    })
                : null}
            </View>
          );
        })}
      </View>
    );
  }
  return (
    <SettingsScreenLayout title={t('workspace.listTitle')} onPressBack={onPressBack}>
      <View testID="workspaces-screen">{body}</View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  intro: { ...text.body, color: colors.textSecondary },
  section: { ...headings.label, color: colors.textSecondary, marginTop: spacing.sm },
  list: { gap: spacing.xs },
  group: { gap: spacing.xs },
  groupLabel: { ...text.emphasis, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  chooseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  flex: { flex: 1, gap: 2 },
  typeLabel: { ...headings.label, color: colors.primary },
  name: { ...text.emphasis, color: colors.textPrimary },
  body: { ...text.body, color: colors.textPrimary },
  meta: { ...text.meta, color: colors.textSecondary },
  warn: { ...text.meta, fontWeight: '700', color: colors.dangerText },
});
