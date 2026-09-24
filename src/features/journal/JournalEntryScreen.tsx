import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { ChevronLeft, ImagePlus, Minus, Plus, Share2, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, ConfirmationModal, IconButton, TextField } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { journalPhotosSupported } from '@/services/journal/journalPhotos';
import { useShareCard } from '@/services/share/useShareCard';
import { useJournalStore } from '@/store/useJournalStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { formatEntryDate, linkArtwork, linkRoute, shiftDate } from './journalDisplay';
import { isValidJournalLink, JOURNAL_EXCERPT_MAX, JOURNAL_NOTE_MAX, JOURNAL_TITLE_MAX, shareExcerpt, validateDraft, type JournalLink } from './journalModel';

function imagePickerAvailable(): boolean {
  return Platform.OS !== 'web' && !!requireOptionalNativeModule('ExponentImagePicker');
}

type Props = {
  /** Existing entry to edit; absent = a new memory. */
  entryId?: string;
  /** A new memory started from a detail screen ("Add to Journal"). */
  initialLink?: JournalLink | null;
  onPressBack: () => void;
};

/**
 * Create / edit one private memory: title, note (kept exactly as typed -
 * never translated), date, an optional photo and an optional link to real
 * OYNO content. Deleting it changes nothing but the journal.
 */
export function JournalEntryScreen({ entryId, initialLink = null, onPressBack }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  const isLoaded = useJournalStore((state) => state.isLoaded);
  const entry = useJournalStore((state) => (entryId ? state.entries.find((item) => item.id === entryId && !item.deletedAt) : undefined));

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [link, setLink] = useState<JournalLink | null>(isValidJournalLink(initialLink) ? initialLink : null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const { share, shareHost } = useShareCard();

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
  }, []);

  // Fill the form once from the stored entry.
  useEffect(() => {
    if (!entry || hydratedId === entry.id) return;
    setTitle(entry.title);
    setNote(entry.note);
    setDate(entry.date);
    setPhotoUri(entry.photo?.localUri ?? null);
    setLink(entry.link);
    setHydratedId(entry.id);
  }, [entry, hydratedId]);

  const today = localDateKey();
  const canUsePhotos = journalPhotosSupported() && imagePickerAvailable();
  const artwork = useMemo(() => linkArtwork(link), [link]);

  if (entryId && isLoaded && !entry) return <NotFoundState message={t('journal.notFound')} onPressBack={onPressBack} />;

  async function pickPhoto() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!picked.canceled && picked.assets[0]) setPhotoUri(picked.assets[0].uri);
    } catch {
      // Picker unavailable in this build - the button is hidden then anyway.
    }
  }

  async function save() {
    const draft = { title, note, date, photoUri, link };
    if (validateDraft(draft).length > 0) {
      setError(t('journal.emptyError'));
      return;
    }
    setSaving(true);
    try {
      const saved = entryId ? await useJournalStore.getState().update(entryId, draft) : await useJournalStore.getState().create(draft);
      if (!saved) {
        setError(t('journal.emptyError'));
        return;
      }
      setError(null);
      if (entryId) onPressBack();
      else router.replace(`/journal/${saved.id}` as never);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!entryId) return;
    setConfirmDelete(false);
    await useJournalStore.getState().remove(entryId);
    onPressBack();
  }

  function shareCard() {
    setShareOpen(false);
    const cardTitle = title.trim() || link?.label || t('journal.untitled');
    // Only the public artwork of the linked content and the line the user
    // typed for the card - never the private note, never the user's photo.
    void share({ title: cardTitle, label: t('journal.shareLabel'), imageSource: artwork, excerpt: shareExcerpt(excerpt) || null }, cardTitle);
    setExcerpt('');
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.title, isAdult && styles.editorial]} accessibilityRole="header" numberOfLines={1}>
          {entryId ? t('journal.editorEditTitle') : isChild ? t('journal.childNew') : t('journal.editorNewTitle')}
        </Text>
        {entryId ? (
          <>
            <IconButton icon={Share2} size={40} iconSize={18} accessibilityLabel={t('journal.share')} onPress={() => setShareOpen(true)} />
            <IconButton icon={Trash2} size={40} iconSize={18} accessibilityLabel={t('journal.delete')} onPress={() => setConfirmDelete(true)} />
          </>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {link ? (
          <View style={styles.linkCard}>
            {artwork ? <Image source={artwork} style={styles.linkImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
            <AnimatedPressable
              style={styles.linkText}
              onPress={() => router.push(linkRoute(link) as never)}
              accessibilityRole="link"
              accessibilityLabel={t('journal.openLinked', { title: link.label })}
            >
              <Text style={styles.linkType}>
                {t('journal.linkedLabel')} · {t(`journal.linkTypes.${link.type}`)}
              </Text>
              <Text style={[styles.linkTitle, isAdult && styles.editorial]} numberOfLines={2}>
                {link.label}
              </Text>
            </AnimatedPressable>
            <IconButton icon={X} size={36} iconSize={16} accessibilityLabel={t('journal.removeLinkA11y', { title: link.label })} onPress={() => setLink(null)} />
          </View>
        ) : null}

        <TextField label={t('journal.titleLabel')} value={title} onChangeText={(value) => setTitle(value.slice(0, JOURNAL_TITLE_MAX))} placeholder={t('journal.titlePlaceholder')} autoCapitalize="sentences" />

        <TextField
          label={t('journal.noteLabel')}
          value={note}
          onChangeText={(value) => setNote(value.slice(0, JOURNAL_NOTE_MAX))}
          placeholder={t('journal.notePlaceholder')}
          autoCapitalize="sentences"
          multiline
          numberOfLines={isChild ? 4 : 7}
        />

        <Text style={styles.label}>{t('journal.dateLabel')}</Text>
        <View style={styles.dateRow} accessibilityRole="adjustable" accessibilityLabel={`${t('journal.dateLabel')}, ${formatEntryDate(date, language)}`}>
          <AnimatedPressable style={[styles.stepButton, isChild && styles.stepButtonChild]} onPress={() => setDate(shiftDate(date, -1))} accessibilityRole="button" accessibilityLabel={t('journal.dateEarlier')}>
            <Minus size={18} color={colors.primary} strokeWidth={2.5} />
          </AnimatedPressable>
          <Text style={[styles.dateText, isChild && styles.dateTextChild]}>{date === today ? t('journal.today') : formatEntryDate(date, language)}</Text>
          <AnimatedPressable
            style={[styles.stepButton, isChild && styles.stepButtonChild, date >= today && styles.stepDisabled]}
            onPress={() => date < today && setDate(shiftDate(date, 1))}
            disabled={date >= today}
            accessibilityRole="button"
            accessibilityState={{ disabled: date >= today }}
            accessibilityLabel={t('journal.dateLater')}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>

        <Text style={styles.label}>{t('journal.photoLabel')}</Text>
        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={[styles.photo, isChild && styles.photoChild]} resizeMode="cover" accessibilityLabel={t('journal.photoA11y')} />
            <View style={styles.photoActions}>
              {canUsePhotos ? <Button label={t('journal.changePhoto')} variant="secondary" onPress={() => void pickPhoto()} /> : null}
              <Button label={t('journal.removePhoto')} variant="secondary" onPress={() => setPhotoUri(null)} />
            </View>
          </View>
        ) : canUsePhotos ? (
          <AnimatedPressable style={[styles.addPhoto, isChild && styles.addPhotoChild]} onPress={() => void pickPhoto()} accessibilityRole="button" accessibilityLabel={t('journal.addPhoto')}>
            <ImagePlus size={isChild ? 26 : 20} color={colors.primary} strokeWidth={2} />
            <Text style={styles.addPhotoText}>{t('journal.addPhoto')}</Text>
          </AnimatedPressable>
        ) : (
          <Text style={styles.note}>{t('journal.photosPhoneOnly')}</Text>
        )}

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label={t('journal.save')} onPress={() => void save()} loading={saving} />
      </ScrollView>

      <ConfirmationModal
        visible={confirmDelete}
        title={t('journal.deleteTitle')}
        message={t('journal.deleteBody')}
        confirmLabel={t('journal.deleteConfirm')}
        cancelLabel={t('journal.cancel')}
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmationModal
        visible={shareOpen}
        title={t('journal.shareTitle')}
        message={t('journal.shareIntro')}
        confirmLabel={t('journal.shareConfirm')}
        cancelLabel={t('journal.cancel')}
        onConfirm={shareCard}
        onCancel={() => setShareOpen(false)}
      >
        <TextField
          label={t('journal.shareExcerptLabel')}
          value={excerpt}
          onChangeText={(value) => setExcerpt(value.slice(0, JOURNAL_EXCERPT_MAX))}
          placeholder={t('journal.shareExcerptPlaceholder')}
          autoCapitalize="sentences"
        />
      </ConfirmationModal>
      {shareHost}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  editorial: { fontFamily: fontFamily.wordmark },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  label: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.xl, backgroundColor: colors.surface },
  linkImage: { width: 56, height: 56, borderRadius: radii.lg },
  linkText: { flex: 1, gap: 2 },
  linkType: { ...typography.small, fontWeight: '600', color: colors.accentTerracotta },
  linkTitle: { ...typography.bodyBold, color: colors.textPrimary },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepButtonChild: { width: 56, height: 56, borderRadius: 28 },
  stepDisabled: { opacity: 0.4 },
  dateText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  dateTextChild: { fontSize: 19 },
  photoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  photo: { width: 120, height: 120, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt },
  photoChild: { width: 150, height: 150 },
  photoActions: { flex: 1, gap: spacing.xs },
  addPhoto: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
  addPhotoChild: { minHeight: 80 },
  addPhotoText: { ...typography.bodyBold, color: colors.primary },
  note: { ...typography.small, fontWeight: '500', color: colors.textMuted },
  error: { ...typography.caption, color: colors.accentTerracotta },
});
