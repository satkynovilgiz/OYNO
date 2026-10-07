import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, ImagePlus, Link2, Lock, Minus, Pencil, Plus, Share2, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, ConfirmationModal, IconButton, MediaImage, TextField } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { journalPhotosSupported } from '@/services/journal/journalPhotos';
import { deleteTempImage, JOURNAL_IMAGE, normalizeToJpeg, pickerOptionsForJpeg } from '@/services/media/normalizeImage';
import { useShareCard } from '@/services/share/useShareCard';
import { JournalSaveError, useJournalStore } from '@/store/useJournalStore';
import { cardRadii, colors, editorial, fontFamily, spacing, textStyles } from '@/theme';

import { baselineForNew } from './editor/editorDraft';
import { LeaveEditorModal, RestoreDraftModal } from './editor/EditorDialogs';
import { useEditorSession } from './editor/useEditorSession';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { formatEntryDate, linkArtwork, linkRoute, shiftDate } from './journalDisplay';
import { isValidJournalLink, JOURNAL_EXCERPT_MAX, JOURNAL_NOTE_MAX, JOURNAL_TITLE_MAX, shareExcerpt, validateDraft, type JournalLink } from './journalModel';
import { showToast } from '@/components/ui/Toast';
import { LinkContentSheet } from './LinkContentSheet';
import { getPrompt } from './prompts/journalPrompts';

function imagePickerAvailable(): boolean {
  return Platform.OS !== 'web' && !!requireOptionalNativeModule('ExponentImagePicker');
}

type Props = {
  /** Existing entry to edit; absent = a new memory. */
  entryId?: string;
  /** A new memory started from a detail screen ("Add to Journal"). */
  initialLink?: JournalLink | null;
  /** New memory pre-filled from the Journal calendar (YYYY-MM-DD, not in the future); still editable. */
  initialDate?: string | null;
  /** Optional writing prompt (new memories only): shown as helper text, never inserted into the note or stored. */
  promptId?: string | null;
  onPressBack: () => void;
};

/**
 * Create / edit one private memory: title, note (kept exactly as typed -
 * never translated), date, an optional photo and an optional link to real
 * OYNO content. Deleting it changes nothing but the journal.
 */
export function JournalEntryScreen({ entryId, initialLink = null, initialDate = null, promptId = null, onPressBack }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  const isLoaded = useJournalStore((state) => state.isLoaded);
  const entry = useJournalStore((state) => (entryId ? state.entries.find((item) => item.id === entryId && !item.deletedAt) : undefined));

  const [newBaseline] = useState(() =>
    baselineForNew(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && initialDate <= localDateKey() ? initialDate : localDateKey(), isValidJournalLink(initialLink) ? initialLink : null),
  );
  const session = useEditorSession({ entryId, entry, journalLoaded: isLoaded, newBaseline });
  const { fields, setFields, dirty } = session;
  const { title, note, date, photoUri, link } = fields;
  const setTitle = (value: string) => setFields((current) => ({ ...current, title: value }));
  const setNote = (value: string) => setFields((current) => ({ ...current, note: value }));
  const setDate = (value: string) => setFields((current) => ({ ...current, date: value }));
  const setPhotoUri = (value: string | null) => setFields((current) => ({ ...current, photoUri: value }));
  const setLink = (value: JournalLink | null) => setFields((current) => ({ ...current, link: value }));

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(!entryId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [promptHidden, setPromptHidden] = useState(false);
  /** Where to go once the person picks Save / Discard in the leave dialog. */
  const [leaving, setLeaving] = useState<{ proceed: () => void } | null>(null);
  const prompt = !entryId && !promptHidden ? getPrompt(promptId) : null;
  const { share, shareHost } = useShareCard();

  useEffect(() => {
    if (!useJournalStore.getState().isLoaded) void useJournalStore.getState().load();
  }, []);

  const today = localDateKey();
  const canUsePhotos = journalPhotosSupported() && imagePickerAvailable();
  const artwork = useMemo(() => linkArtwork(link), [link]);
  const unsaved = editing && dirty && !session.ownerChanged;
  /** Back from the form: an edit returns to its detail view; a new memory leaves. */
  const backFromForm = editing && entryId ? () => setEditing(false) : onPressBack;

  const guard = useLeaveGuard({
    active: unsaved,
    onBlocked: (proceed) => setLeaving({ proceed }),
    onHardwareBack: () => {
      if (leaving || session.phase === 'offer') return true;
      if (unsaved) {
        setLeaving({ proceed: backFromForm });
        return true;
      }
      if (editing && entryId) {
        setEditing(false);
        return true;
      }
      return false;
    },
  });

  // The signed-in account changed while this editor was open: its writing
  // belongs to the previous owner - it leaves the screen (and memory) now.
  // Where to go next is the auth flow's job; this screen only closes.
  useEffect(() => {
    if (!session.ownerChanged) return;
    setFields(newBaseline);
    setExcerpt('');
    setLeaving(null);
    setConfirmDelete(false);
    setShareOpen(false);
    guard.allowLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.ownerChanged]);

  if (session.ownerChanged) return <NotFoundState message={t('journal.draft.accountChanged')} onPressBack={() => router.replace('/journal' as never)} />;
  if (entryId && isLoaded && !entry) return <NotFoundState message={t('journal.notFound')} onPressBack={onPressBack} />;

  function requestLeave(proceed: () => void) {
    if (unsaved) setLeaving({ proceed });
    else proceed();
  }

  // The picked image (HEIC/PNG/JPEG) becomes a real, resized JPEG before
  // it's shown or saved; if that fails the current photo stays as it was.
  async function pickPhoto() {
    let picked: import('expo-image-picker').ImagePickerAsset | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptionsForJpeg());
      if (result.canceled || !result.assets[0]) return;
      picked = result.assets[0];
    } catch {
      setError(t('journal.photoError'));
      return;
    }
    try {
      const normalized = await normalizeToJpeg(picked, JOURNAL_IMAGE);
      if (normalized.uri !== picked.uri) deleteTempImage(picked.uri);
      // The previous pick is NOT deleted here: a stored draft may still point
      // at it. Temp photos are released once nothing references them.
      session.trackTemp(normalized.uri);
      setPhotoUri(normalized.uri);
      setError(null);
    } catch {
      setError(t('journal.photoError'));
    }
  }

  /** Saves; true on success. A failure keeps the form and the draft as they are. */
  async function save(): Promise<boolean> {
    const draft = { title, note, date, photoUri, link };
    if (validateDraft(draft).length > 0) {
      setError(t('journal.emptyError'));
      return false;
    }
    setSaving(true);
    session.pause();
    try {
      const saved = entryId ? await useJournalStore.getState().update(entryId, draft) : await useJournalStore.getState().create(draft, { id: session.newEntryId });
      if (!saved) {
        setError(t(entryId ? 'journal.notFound' : 'journal.emptyError'));
        session.resume();
        await session.flush();
        return false;
      }
      setError(null);
      await session.finish({ keepEditing: !!entryId });
      showToast(t('toast.journalSaved'), { haptic: true });
      return true;
    } catch (failure) {
      const reason = failure instanceof JournalSaveError ? failure.reason : 'storage';
      if (reason === 'account_changed') return false;
      setError(t(reason === 'photo' ? 'journal.draft.savePhotoFailed' : 'journal.draft.saveFailed'));
      session.resume();
      // The person's work survives the failure - also an app restart.
      await session.flush();
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndStay() {
    if (!(await save())) return;
    if (entryId) setEditing(false);
    else {
      guard.allowLeave();
      router.replace(`/journal/${session.newEntryId}` as never);
    }
  }

  async function leaveWithSave() {
    const pending = leaving;
    if (!(await save())) {
      // The error is shown on the form; the person stays to fix or retry.
      setLeaving(null);
      return;
    }
    setLeaving(null);
    guard.allowLeave();
    pending?.proceed();
  }

  async function leaveWithDiscard() {
    const pending = leaving;
    setLeaving(null);
    await session.finish({ resetTo: session.baseline, keepEditing: !!entryId });
    setError(null);
    announce(t('journal.draft.discarded'));
    guard.allowLeave();
    pending?.proceed();
  }

  function restoreDraft() {
    const { photoLost } = session.restore();
    if (entryId) setEditing(true);
    announce(t('journal.draft.restored'));
    if (photoLost) setError(t('journal.draft.photoLost'));
  }

  async function remove() {
    if (!entryId) return;
    setConfirmDelete(false);
    await session.finish();
    guard.allowLeave();
    await useJournalStore.getState().remove(entryId);
    onPressBack();
  }

  function openShare() {
    setShareOpen(false);
    const cardTitle = title.trim() || link?.label || t('journal.untitled');
    // Only what the user chooses: the linked content's public artwork OR
    // their own photo OR no picture, plus the one line typed for the card.
    // The private note is never added.
    const choices = [
      ...(artwork ? [{ key: 'artwork', label: t('journal.v2.artwork'), image: artwork }] : []),
      ...(photoUri ? [{ key: 'photo', label: t('journal.v2.myPhoto'), image: { uri: photoUri } }] : []),
      { key: 'none', label: t('journal.v2.noImage'), image: null },
    ];
    void share(
      { title: cardTitle, label: t('journal.shareLabel'), imageSource: choices[0].image, excerpt: shareExcerpt(excerpt) || null, variant: 'journal', linkedLabel: link?.label ?? null },
      cardTitle,
      { imageChoices: choices },
    );
    setExcerpt('');
  }

  const showDetail = !!entryId && !editing && !!entry;
  const displayTitle = title.trim() || link?.label || t('journal.untitled');

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} testID="journal-back" onPress={() => requestLeave(backFromForm)} />
        <Text style={[styles.title, isAdult && styles.editorial]} accessibilityRole="header" numberOfLines={1}>
          {showDetail ? '' : entryId ? t('journal.editorEditTitle') : isChild ? t('journal.childNew') : t('journal.editorNewTitle')}
        </Text>
        <View style={styles.private} accessible accessibilityLabel={t('journal.privateBadge')}>
          <Lock size={11} color={colors.textMuted} strokeWidth={2.25} />
          <Text style={styles.privateText}>{t('journal.privateBadge')}</Text>
        </View>
      </View>

      {showDetail ? (
        <ScrollView contentContainerStyle={[styles.detail, { paddingBottom: insets.bottom + spacing.xxl }]}>
          {/* Memory detail: photo -> title -> date -> note -> linked content -> actions. */}
          {photoUri ? <MediaImage source={{ uri: photoUri }} fill={false} style={styles.detailPhoto} /> : null}
          <Text style={styles.detailDate}>{formatEntryDate(date, language)}</Text>
          <Text style={[styles.detailTitle, !isChild && styles.editorialTitle]} accessibilityRole="header">
            {displayTitle}
          </Text>
          {/* Exactly as the user wrote it - never translated. */}
          {note ? <Text style={[styles.detailNote, isChild && styles.detailNoteChild]}>{note}</Text> : null}
          {link ? (
            <AnimatedPressable style={styles.linkCard} onPress={() => router.push(linkRoute(link) as never)} press="soft" accessibilityRole="link" accessibilityLabel={t('journal.openLinked', { title: link.label })}>
              {artwork ? <Image source={artwork} style={styles.linkImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              <View style={styles.linkText}>
                <Text style={styles.linkType}>
                  {t('journal.linkedLabel')} · {t(`journal.linkTypes.${link.type}`)}
                </Text>
                <Text style={[styles.linkTitle, isAdult && styles.editorial]} numberOfLines={2}>
                  {link.label}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          ) : null}
          <View style={styles.detailActions}>
            <Button label={t('journal.v2.edit')} icon={<Pencil size={16} color={colors.primary} strokeWidth={2.25} />} variant="secondary" onPress={() => setEditing(true)} />
            <Button label={t('journal.share')} icon={<Share2 size={16} color={colors.textPrimary} strokeWidth={2.25} />} variant="accent" onPress={() => setShareOpen(true)} />
          </View>
          <View style={styles.deleteRow}>
            <Button label={t('journal.delete')} icon={<Trash2 size={15} color={colors.error} strokeWidth={2.25} />} variant="text" onPress={() => setConfirmDelete(true)} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
          <TextField testID="journal-title" label={t('journal.titleLabel')} value={title} onChangeText={(value) => setTitle(value.slice(0, JOURNAL_TITLE_MAX))} placeholder={t('journal.titlePlaceholder')} autoCapitalize="sentences" />

          {/* Photo: preview + Change / Remove, or one dashed "Add a photo". */}
          {photoUri ? (
            <View style={styles.photoBlock}>
              <MediaImage source={{ uri: photoUri }} fill={false} style={[styles.photo, isChild && styles.photoChild]} />
              <View style={styles.photoActions}>
                {canUsePhotos ? <Button label={t('journal.changePhoto')} variant="secondary" size="sm" onPress={() => void pickPhoto()} /> : null}
                <Button label={t('journal.removePhoto')} variant="text" size="sm" onPress={() => setPhotoUri(null)} />
              </View>
            </View>
          ) : canUsePhotos ? (
            <AnimatedPressable style={[styles.addPhoto, isChild && styles.addPhotoChild]} onPress={() => void pickPhoto()} press="soft" accessibilityRole="button" accessibilityLabel={t('journal.addPhoto')}>
              <ImagePlus size={isChild ? 26 : 20} color={colors.primary} strokeWidth={2} />
              <Text style={styles.addPhotoText}>{t('journal.addPhoto')}</Text>
            </AnimatedPressable>
          ) : (
            <Text style={styles.note}>{t('journal.photosPhoneOnly')}</Text>
          )}

          {/* Writing prompt: helper text beside the note - the note stays exactly what the person types. */}
          {prompt ? (
            <View style={styles.prompt} accessible accessibilityLabel={`${t('journalPrompts.promptLabel')}: ${t(prompt.textKey)}. ${t('journalPrompts.notSaved')}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.promptLabel}>{t('journalPrompts.promptLabel')}</Text>
                <Text style={[styles.promptText, isChild && styles.promptTextChild]}>{t(prompt.textKey)}</Text>
                <Text style={styles.note}>{t('journalPrompts.notSaved')}</Text>
              </View>
              <IconButton icon={X} size={36} iconSize={16} elevated={false} accessibilityLabel={t('journalPrompts.hide')} onPress={() => setPromptHidden(true)} />
            </View>
          ) : null}
          <TextField
            testID="journal-note"
            label={t('journal.noteLabel')}
            value={note}
            onChangeText={(value) => setNote(value.slice(0, JOURNAL_NOTE_MAX))}
            placeholder={t('journal.notePlaceholder')}
            autoCapitalize="sentences"
            multiline
            numberOfLines={isChild ? 4 : 6}
          />

          {/* Date: a quiet row; the stepper opens only when asked for. */}
          {dateOpen ? (
            <View style={styles.dateRow} accessibilityRole="adjustable" accessibilityLabel={`${t('journal.dateLabel')}, ${formatEntryDate(date, language)}`}>
              <AnimatedPressable style={[styles.stepButton, isChild && styles.stepButtonChild]} onPress={() => setDate(shiftDate(date, -1))} press="strong" accessibilityRole="button" accessibilityLabel={t('journal.dateEarlier')}>
                <Minus size={18} color={colors.primary} strokeWidth={2.5} />
              </AnimatedPressable>
              <Text style={[styles.dateText, isChild && styles.dateTextChild]}>{date === today ? t('journal.today') : formatEntryDate(date, language)}</Text>
              <AnimatedPressable
                style={[styles.stepButton, isChild && styles.stepButtonChild, date >= today && styles.stepDisabled]}
                onPress={() => date < today && setDate(shiftDate(date, 1))}
                disabled={date >= today}
                press="strong"
                accessibilityRole="button"
                accessibilityState={{ disabled: date >= today }}
                accessibilityLabel={t('journal.dateLater')}
              >
                <Plus size={18} color={colors.primary} strokeWidth={2.5} />
              </AnimatedPressable>
            </View>
          ) : (
            <AnimatedPressable style={styles.optionRow} onPress={() => setDateOpen(true)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('journal.v2.addDate')}. ${formatEntryDate(date, language)}`}>
              <CalendarDays size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.optionLabel}>{t('journal.dateLabel')}</Text>
              <Text style={styles.optionValue}>{date === today ? t('journal.today') : formatEntryDate(date, language)}</Text>
            </AnimatedPressable>
          )}

          {/* Linked OYNO content. */}
          {link ? (
            <View style={styles.linkCard}>
              {artwork ? <Image source={artwork} style={styles.linkImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              <View style={styles.linkText}>
                <Text style={styles.linkType}>
                  {t('journal.linkedLabel')} · {t(`journal.linkTypes.${link.type}`)}
                </Text>
                <Text style={[styles.linkTitle, isAdult && styles.editorial]} numberOfLines={2}>
                  {link.label}
                </Text>
              </View>
              <IconButton icon={X} size={36} iconSize={16} elevated={false} accessibilityLabel={t('journal.removeLinkA11y', { title: link.label })} onPress={() => setLink(null)} />
            </View>
          ) : (
            <AnimatedPressable style={styles.optionRow} onPress={() => setPickerOpen(true)} press="soft" accessibilityRole="button" accessibilityLabel={t('journal.v2.linkContent')}>
              <Link2 size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.optionLabel}>{t('journal.v2.linkContent')}</Text>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          )}

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label={t('journal.save')} variant="accent" size="lg" block onPress={() => void saveAndStay()} loading={saving} testID="journal-save" />
        </ScrollView>
      )}

      <LinkContentSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(picked) => {
          setLink(picked);
          setPickerOpen(false);
        }}
      />
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
        onConfirm={openShare}
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
      <LeaveEditorModal visible={!!leaving} saving={saving} onSave={() => void leaveWithSave()} onDiscard={() => void leaveWithDiscard()} onKeepEditing={() => setLeaving(null)} />
      <RestoreDraftModal visible={session.phase === 'offer' && !!session.offer} isNew={!entryId} entryChangedSince={!!session.offer?.entryChangedSince} onRestore={restoreDraft} onDiscard={() => void session.discardOffer()} />
      {shareHost}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...textStyles.title, color: colors.textPrimary, flex: 1 },
  editorial: { fontFamily: fontFamily.wordmark },
  private: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  privateText: { ...textStyles.small, color: colors.textMuted },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  detail: { paddingHorizontal: spacing.md, gap: spacing.sm },
  detailPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, marginBottom: spacing.xs },
  detailDate: { ...textStyles.caption, color: colors.textMuted },
  detailTitle: { ...textStyles.h1, color: colors.textPrimary },
  editorialTitle: { ...editorial(textStyles.h1) },
  detailNote: { ...textStyles.body, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  detailNoteChild: { fontSize: 18, lineHeight: 27 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  deleteRow: { flexDirection: 'row', marginTop: spacing.xs },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  linkImage: { width: 52, height: 52, borderRadius: 14 },
  linkText: { flex: 1, gap: 2 },
  linkType: { ...textStyles.small, color: colors.accentTerracotta },
  linkTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  optionLabel: { ...textStyles.bodyMedium, color: colors.textPrimary, flex: 1 },
  optionValue: { ...textStyles.caption, color: colors.textSecondary },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  stepButtonChild: { width: 56, height: 56, borderRadius: 28 },
  stepDisabled: { opacity: 0.4 },
  dateText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: 'center' },
  dateTextChild: { fontSize: 19 },
  photoBlock: { gap: spacing.xs },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media },
  photoChild: { aspectRatio: 1 },
  photoActions: { flexDirection: 'row', gap: spacing.xs },
  addPhoto: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: cardRadii.compact, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  addPhotoChild: { minHeight: 88 },
  addPhotoText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  note: { ...textStyles.small, color: colors.textMuted },
  error: { ...textStyles.caption, color: colors.accentTerracotta },
  prompt: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  promptLabel: { ...textStyles.overline, color: colors.accentTerracotta },
  promptText: { ...textStyles.bodyMedium, fontWeight: '600', color: colors.textPrimary },
  promptTextChild: { fontSize: 18, lineHeight: 26 },
});
