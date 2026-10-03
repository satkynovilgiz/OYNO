import { router } from 'expo-router';
import { ChevronLeft, Headphones, Music, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { komuzTracks } from '@/features/culture/audioData';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { formatAudioTime } from '@/services/audioGuide/narration';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { ownerListening, useListeningStore } from '@/store/useListeningStore';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { continueListening, recentListening, resumeRoute, sortedBookmarks, type ListeningSource, type PositionType } from './listeningModel';
import { usePrivateSyncScope } from '@/services/sync/privateSync/usePrivateSyncScope';

/**
 * /profile/listening - private listening history and audio bookmarks over
 * the existing Audio Guide and Komuz tracks. Opening an entry only opens
 * the content; the audio starts when "Resume listening" is tapped there.
 */
export function ListeningScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const syncScope = usePrivateSyncScope();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const data = ownerListening(useListeningStore((state) => state.saved), owner);
  const { data: items } = useAllCultureItems();
  const { data: materials } = useCultureMaterials();

  useEffect(() => {
    void useListeningStore.getState().load();
  }, []);

  // A source that no longer exists stays listed as "Source unavailable".
  const exists = (item: { sourceType: ListeningSource; sourceId: string }) => {
    if (item.sourceType === 'komuz') return komuzTracks.some((track) => track.id === item.sourceId);
    const [type, id] = [item.sourceId.slice(0, item.sourceId.indexOf(':')), item.sourceId.slice(item.sourceId.indexOf(':') + 1)];
    if (type === 'culture_item') return !items || items.some((row) => row.id === id);
    if (type === 'culture_material') return !materials || materials.some((row) => row.id === id);
    return true;
  };
  const where = (type: PositionType | null, position: number | null) =>
    position === null || type === null ? null : type === 'seconds' ? formatAudioTime(position) : t('listening.section', { number: position + 1 });
  const whereSpoken = (type: PositionType | null, position: number | null) =>
    position === null || type === null ? '' : type === 'seconds' ? t('listening.at', { minutes: Math.floor(position / 60), seconds: position % 60 }) : t('listening.section', { number: position + 1 });

  const resume = continueListening(data, exists);
  const bookmarks = sortedBookmarks(data);
  const recent = recentListening(data);
  const typeLabel = (sourceType: ListeningSource) => (sourceType === 'komuz' ? t('listening.komuzTrack') : t('listening.narration'));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('listening.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {resume ? (
          <AnimatedPressable
            style={styles.continue}
            onPress={() => router.push(resumeRoute(resume) as never)}
            accessibilityRole="button"
            accessibilityLabel={`${t('listening.continue')}. ${typeLabel(resume.sourceType)}: ${resume.title}. ${t('listening.resume')} ${whereSpoken(resume.positionType, resume.position)}`}
          >
            <Text style={styles.kicker}>{t('listening.continue')}</Text>
            <Text style={styles.itemTitle}>{resume.title}</Text>
            <Text style={styles.meta}>
              {typeLabel(resume.sourceType)} · {where(resume.positionType, resume.position)}
            </Text>
          </AnimatedPressable>
        ) : null}

        <Text style={styles.section} accessibilityRole="header">
          {t('listening.bookmarks')}
        </Text>
        {bookmarks.length === 0 ? <Text style={styles.empty}>{t('listening.noBookmarks')}</Text> : null}
        {bookmarks.map((bookmark) => {
          const available = exists(bookmark);
          return (
            <View key={bookmark.id} style={styles.row}>
              <AnimatedPressable
                style={styles.rowMain}
                disabled={!available}
                onPress={() => router.push(resumeRoute(bookmark) as never)}
                accessibilityRole="button"
                accessibilityLabel={available ? `${typeLabel(bookmark.sourceType)}: ${bookmark.title}. ${t('listening.resume')} ${whereSpoken(bookmark.positionType, bookmark.position)}` : `${bookmark.title}. ${t('listening.unavailable')}`}
              >
                {bookmark.sourceType === 'komuz' ? <Music size={16} color={colors.textSecondary} strokeWidth={2} /> : <Headphones size={16} color={colors.textSecondary} strokeWidth={2} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, !available && styles.unavailable]} numberOfLines={1}>
                    {bookmark.title}
                  </Text>
                  <Text style={styles.meta}>{available ? where(bookmark.positionType, bookmark.position) : t('listening.unavailable')}</Text>
                </View>
              </AnimatedPressable>
              <IconButton icon={X} size={32} iconSize={14} elevated={false} accessibilityLabel={t('listening.removeBookmark', { title: bookmark.title })} onPress={() => useListeningStore.getState().removeBookmark(owner, bookmark.id)} />
            </View>
          );
        })}

        <Text style={styles.section} accessibilityRole="header">
          {t('listening.recent')}
        </Text>
        {recent.length === 0 ? <Text style={styles.empty}>{t('listening.noHistory')}</Text> : null}
        {recent.map((record) => {
          const available = exists(record);
          return (
            <AnimatedPressable
              key={record.key}
              style={[styles.row, styles.rowMain]}
              disabled={!available}
              onPress={() => router.push(resumeRoute(record) as never)}
              accessibilityRole="button"
              accessibilityLabel={`${typeLabel(record.sourceType)}: ${record.title}. ${record.completed ? t('listening.finished') : whereSpoken(record.positionType, record.position)}`}
            >
              {record.sourceType === 'komuz' ? <Music size={16} color={colors.textSecondary} strokeWidth={2} /> : <Headphones size={16} color={colors.textSecondary} strokeWidth={2} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, !available && styles.unavailable]} numberOfLines={1}>
                  {record.title}
                </Text>
                <Text style={styles.meta}>
                  {!available ? t('listening.unavailable') : record.completed ? t('listening.finished') : (where(record.positionType, record.position) ?? typeLabel(record.sourceType))}
                </Text>
              </View>
            </AnimatedPressable>
          );
        })}
        <Text style={styles.note}>{t(syncScope === 'account' ? 'listening.accountNote' : 'listening.deviceNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  continue: { gap: 2, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accentGold },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  section: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.xs },
  itemTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  unavailable: { color: colors.textMuted, fontStyle: 'italic' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  empty: { ...textStyles.small, color: colors.textMuted },
  note: { ...textStyles.small, color: colors.textMuted, marginTop: spacing.sm },
});
