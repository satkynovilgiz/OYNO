import { requireOptionalNativeModule } from 'expo';
import { Camera, ChevronDown, ChevronUp, ImagePlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, TextField, Toggle } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { currentRoute, recordDiagnostic } from '@/services/feedback/diagnosticTrail';
import { buildDiagnostics, isSensitiveRoute } from '@/services/feedback/diagnostics';
import { FEEDBACK_CATEGORIES, MAX_FEEDBACK_LENGTH, retryFeedback, sendFeedbackReport, type FeedbackCategory, type SubmitResult } from '@/services/feedback/feedbackQueue';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { colors, radii, spacing, typography } from '@/theme';

/** Time for the sheet to slide away before the screen underneath is captured. */
const HIDE_BEFORE_CAPTURE_MS = 450;

function screenCaptureAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!(TurboModuleRegistry.get('RNViewShot') ?? NativeModules.RNViewShot);
  } catch {
    return false;
  }
}

function imagePickerAvailable(): boolean {
  return Platform.OS === 'web' || !!requireOptionalNativeModule('ExponentImagePicker');
}

/**
 * Beta Feedback sheet - root-mounted, opened from Settings -> Help &
 * Feedback or from "Report a problem" on an error / not-found screen.
 * Category + message, an OPTIONAL image, and a plain list of the
 * technical details that will be attached (nothing hidden from the tester).
 */
export function FeedbackSheet() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { visible, context, close } = useFeedbackStore();
  const { experience } = useAgeExperience();
  const { isOffline } = useNetworkStatus();
  const user = useAuthStore((state) => (state.status === 'authenticated' ? state.user : null));

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [includeEmail, setIncludeEmail] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);

  // A fresh form each time the sheet opens.
  useEffect(() => {
    if (!visible || capturing) return;
    if (result === null && message === '' && !screenshotUri) {
      setCategory(context.category ?? 'bug');
      setRoute(currentRoute());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function reset() {
    setCategory('bug');
    setMessage('');
    setIncludeEmail(false);
    setScreenshotUri(null);
    setShowDetails(false);
    setResult(null);
    setReportId(null);
  }

  function dismiss() {
    close();
    reset();
  }

  const sensitive = isSensitiveRoute(route);
  const canCapture = screenCaptureAvailable() && !sensitive;
  const canPick = imagePickerAvailable();

  async function attachCurrentScreen() {
    if (!canCapture) return;
    setCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, HIDE_BEFORE_CAPTURE_MS));
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureScreen } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      const uri = await captureScreen({ format: 'jpg', quality: 0.8, result: 'tmpfile' });
      setScreenshotUri(uri);
    } catch {
      recordDiagnostic('native_unavailable', 'screen_capture');
    } finally {
      setCapturing(false);
    }
  }

  async function chooseImage() {
    if (!canPick) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!picked.canceled && picked.assets[0]) setScreenshotUri(picked.assets[0].uri);
    } catch {
      recordDiagnostic('native_unavailable', 'image_picker');
    }
  }

  const diagnostics = buildDiagnostics({
    language: i18n.language,
    ageMode: experience,
    online: !isOffline,
    route,
    errorFingerprint: context.errorFingerprint,
    contactEmail: includeEmail ? (user?.email ?? null) : null,
  });

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const outcome = await sendFeedbackReport(
        { category, message, diagnostics, screenshotUri, accountId: user?.id ?? null },
        { online: !isOffline, currentAccountId: user?.id ?? null },
      );
      setReportId(outcome.clientReportId);
      setResult(outcome.result);
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    if (!reportId || sending) return;
    setSending(true);
    try {
      setResult(await retryFeedback(reportId, { online: !isOffline, currentAccountId: user?.id ?? null }));
    } finally {
      setSending(false);
    }
  }

  const resultTitle = result === 'sent' ? t('feedback.sentTitle') : result === 'failed' ? t('feedback.failedTitle') : t('feedback.queuedTitle');
  const resultBody = result === 'sent' ? t('feedback.sentBody') : result === 'failed' ? t('feedback.failedBody') : t('feedback.queuedBody');

  const detailRows: [string, string][] = [
    [t('feedback.details.app'), `${diagnostics.appVersion ?? '?'} (${diagnostics.buildNumber ?? '?'})`],
    [t('feedback.details.device'), `${diagnostics.platform} ${diagnostics.osVersion}${diagnostics.deviceClass ? ` · ${diagnostics.deviceClass}` : ''}${diagnostics.deviceModel ? ` · ${diagnostics.deviceModel}` : ''}`],
    [t('feedback.details.language'), `${diagnostics.language}${diagnostics.ageMode ? ` · ${diagnostics.ageMode}` : ''}`],
    [t('feedback.details.screen'), diagnostics.route ?? '-'],
    [t('feedback.details.connection'), diagnostics.online ? t('feedback.details.online') : t('feedback.details.offline')],
    [t('feedback.details.build'), [diagnostics.channel, diagnostics.runtimeVersion].filter(Boolean).join(' · ') || '-'],
    [t('feedback.details.events'), t('feedback.details.eventCount', { count: diagnostics.trail.length })],
  ];

  return (
    <Modal visible={visible && !capturing} transparent animationType="slide" onRequestClose={dismiss}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('feedback.title')}
            </Text>
            <IconButton icon={X} size={36} iconSize={18} accessibilityLabel={t('feedback.close')} onPress={dismiss} />
          </View>

          {result ? (
            <View style={styles.result} accessibilityLiveRegion="polite">
              <Text style={styles.resultTitle}>{resultTitle}</Text>
              <Text style={styles.resultBody}>{resultBody}</Text>
              {result === 'failed' ? <Button label={t('common.retry')} onPress={() => void retry()} loading={sending} /> : null}
              <Button label={result === 'failed' ? t('feedback.close') : t('feedback.done')} variant={result === 'failed' ? 'secondary' : 'primary'} onPress={dismiss} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.intro}>{t('feedback.intro')}</Text>

              <Text style={styles.sectionLabel}>{t('feedback.categoryLabel')}</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {FEEDBACK_CATEGORIES.map((option) => {
                  const selected = option === category;
                  return (
                    <AnimatedPressable
                      key={option}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setCategory(option)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={t(`feedback.categories.${option}`)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(`feedback.categories.${option}`)}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              <TextField
                label={t('feedback.messageLabel')}
                value={message}
                onChangeText={(value) => setMessage(value.slice(0, MAX_FEEDBACK_LENGTH))}
                placeholder={t('feedback.messagePlaceholder')}
                autoCapitalize="sentences"
                multiline
                numberOfLines={5}
              />

              <Text style={styles.sectionLabel}>{t('feedback.imageLabel')}</Text>
              {screenshotUri ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri: screenshotUri }} style={styles.preview} accessibilityLabel={t('feedback.imageAttached')} />
                  <Button label={t('feedback.removeImage')} variant="secondary" onPress={() => setScreenshotUri(null)} />
                </View>
              ) : (
                <View style={styles.imageActions}>
                  {screenCaptureAvailable() ? (
                    <AnimatedPressable
                      style={[styles.imageButton, !canCapture && styles.imageButtonDisabled]}
                      onPress={() => void attachCurrentScreen()}
                      disabled={!canCapture}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !canCapture }}
                      accessibilityLabel={t('feedback.attachScreen')}
                    >
                      <Camera size={16} color={canCapture ? colors.primary : colors.textMuted} strokeWidth={2} />
                      <Text style={[styles.imageButtonText, !canCapture && styles.imageButtonTextDisabled]}>{t('feedback.attachScreen')}</Text>
                    </AnimatedPressable>
                  ) : null}
                  {canPick ? (
                    <AnimatedPressable style={styles.imageButton} onPress={() => void chooseImage()} accessibilityRole="button" accessibilityLabel={t('feedback.chooseImage')}>
                      <ImagePlus size={16} color={colors.primary} strokeWidth={2} />
                      <Text style={styles.imageButtonText}>{t('feedback.chooseImage')}</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
              )}
              {sensitive && screenCaptureAvailable() && !screenshotUri ? <Text style={styles.note}>{t('feedback.sensitiveScreen')}</Text> : null}
              <Text style={styles.note}>{t('feedback.imageOptional')}</Text>

              {user?.email ? (
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{t('feedback.includeEmail')}</Text>
                  <Toggle value={includeEmail} onValueChange={setIncludeEmail} accessibilityLabel={t('feedback.includeEmail')} />
                </View>
              ) : null}

              <AnimatedPressable
                style={styles.detailsToggle}
                onPress={() => setShowDetails((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDetails }}
                accessibilityLabel={t('feedback.detailsTitle')}
              >
                <Text style={styles.detailsTitle}>{t('feedback.detailsTitle')}</Text>
                {showDetails ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
              </AnimatedPressable>
              {showDetails ? (
                <View style={styles.details}>
                  {detailRows.map(([label, value]) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>
                        {value}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.note}>{t('feedback.detailsNever')}</Text>
                </View>
              ) : null}

              {isOffline ? <Text style={styles.note}>{t('feedback.offlineNote')}</Text> : null}
              <Button label={t('feedback.send')} onPress={() => void send()} disabled={!message.trim()} loading={sending} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,32,24,0.45)' },
  sheet: { maxHeight: '92%', backgroundColor: colors.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, paddingTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  intro: { ...typography.caption, color: colors.textSecondary },
  sectionLabel: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceAlt },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.textOnDark },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  imageButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  imageButtonDisabled: { opacity: 0.55 },
  imageButtonText: { ...typography.caption, fontWeight: '600', color: colors.primary },
  imageButtonTextDisabled: { color: colors.textMuted },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: { width: 64, height: 110, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  note: { ...typography.small, fontWeight: '500', color: colors.textMuted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs },
  toggleLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  detailsToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsTitle: { ...typography.bodyBold, color: colors.textPrimary },
  details: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.sm, gap: spacing.xs },
  detailRow: { flexDirection: 'row', gap: spacing.sm },
  detailLabel: { ...typography.small, fontWeight: '600', color: colors.textSecondary, width: 96 },
  detailValue: { ...typography.small, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  result: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.sm },
  resultTitle: { ...typography.h2, color: colors.textPrimary },
  resultBody: { ...typography.body, color: colors.textSecondary },
});
