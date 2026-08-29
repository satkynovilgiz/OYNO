import { Dices, RotateCcw, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ConfirmationModal, IconButton, TextButton } from '@/components/ui';
import { applySelection } from '@/services/avatar/avatarCatalog';
import { randomizeAvatar } from '@/services/avatar/randomizeAvatar';
import { colors, spacing, typography } from '@/theme';

import { AvatarPreview } from './components/AvatarPreview';
import { CategoryTabBar } from './components/CategoryTabBar';
import { ColorSwatchGrid } from './components/ColorSwatchGrid';
import { ItemGrid } from './components/ItemGrid';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { AVATAR_TABS } from './data';
import type { AvatarConfig, AvatarTabId } from './types';

type AvatarEditorScreenProps = {
  /** 'onboarding' swaps X->Skip and Done->Continue and is reached from
   * ProfileSetupScreen as a 3rd, skippable step; 'standalone' is the
   * normal /avatar-editor route. No store access differs between them -
   * this component stays store-free, mirroring CharacterSelectScreen's
   * own prop-driven convention. */
  mode?: 'standalone' | 'onboarding';
  initialConfig: AvatarConfig;
  /** Precomputed by the caller (route/ProfileSetupScreen) from
   * useProgressStore + avatarUnlocks.getUnlockedItemIds - kept out of
   * this component so it has no store dependency of its own. */
  unlockedItemIds: ReadonlySet<string>;
  isSaving?: boolean;
  saveError?: string | null;
  onComplete: (config: AvatarConfig) => void;
  onSkip?: () => void;
  onCancel: () => void;
};

function isSameConfig(a: AvatarConfig, b: AvatarConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AvatarEditorScreen({
  mode = 'standalone',
  initialConfig,
  unlockedItemIds,
  isSaving = false,
  saveError = null,
  onComplete,
  onSkip,
  onCancel,
}: AvatarEditorScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<AvatarConfig>(initialConfig);
  const [activeTabId, setActiveTabId] = useState<AvatarTabId>('face');
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const isDirty = !isSameConfig(draft, initialConfig);
  const activeTab = useMemo(() => AVATAR_TABS.find((tab) => tab.id === activeTabId) ?? AVATAR_TABS[0], [activeTabId]);

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
      return;
    }
    onCancel();
  };

  const handleRandomize = () => {
    setDraft((current) => randomizeAvatar(current, { unlockedItemIds }));
  };

  const handleReset = () => {
    setDraft(initialConfig);
    setShowResetModal(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {mode === 'onboarding' ? (
          <TextButton label={t('avatar.skip')} tone="muted" onPress={() => onSkip?.()} />
        ) : (
          <IconButton icon={X} shape="circle" accessibilityLabel={t('avatar.closeLabel')} onPress={handleClose} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {t('avatar.title')}
        </Text>
        <TextButton
          label={mode === 'onboarding' ? t('avatar.continue') : t('avatar.done')}
          onPress={() => onComplete(draft)}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AvatarPreview config={draft} />

        <View style={styles.utilityRow}>
          <TextButton
            label={t('avatar.randomize')}
            trailingIcon={<Dices size={16} color={colors.primary} strokeWidth={2} />}
            onPress={handleRandomize}
          />
          <TextButton
            label={t('avatar.reset')}
            tone="muted"
            trailingIcon={<RotateCcw size={16} color={colors.textSecondary} strokeWidth={2} />}
            onPress={() => setShowResetModal(true)}
          />
        </View>

        <CategoryTabBar activeTabId={activeTabId} onSelectTab={setActiveTabId} />

        <View style={styles.sections}>
          {activeTab.sections.map((section) => (
            <View key={section.kind === 'items' ? section.categoryId : section.fieldId} style={styles.section}>
              <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
              {section.kind === 'colors' ? (
                <ColorSwatchGrid
                  fieldId={section.fieldId}
                  selectedId={draft[section.fieldId]}
                  onSelect={(id) => setDraft((current) => ({ ...current, [section.fieldId]: id }) as AvatarConfig)}
                />
              ) : (
                <ItemGrid
                  categoryId={section.categoryId}
                  icon={activeTab.icon}
                  selectedId={draft[section.categoryId]}
                  unlockedItemIds={unlockedItemIds}
                  onSelect={(itemId) => {
                    if (!unlockedItemIds.has(itemId)) return;
                    setDraft((current) => applySelection(current, section.categoryId, itemId));
                  }}
                />
              )}
            </View>
          ))}
        </View>

        {saveError ? <Text style={styles.errorText}>{t('avatar.saveErrorTitle')}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button
          label={saveError ? t('avatar.saveErrorRetry') : mode === 'onboarding' ? t('avatar.continue') : t('avatar.done')}
          onPress={() => onComplete(draft)}
          loading={isSaving}
        />
      </View>

      <UnsavedChangesModal
        visible={showUnsavedModal}
        onDiscard={() => {
          setShowUnsavedModal(false);
          onCancel();
        }}
        onKeepEditing={() => setShowUnsavedModal(false)}
      />

      <ConfirmationModal
        visible={showResetModal}
        title={t('avatar.resetConfirmTitle')}
        message={t('avatar.resetConfirmMessage')}
        confirmLabel={t('avatar.resetConfirm')}
        cancelLabel={t('avatar.resetCancel')}
        destructive
        onConfirm={handleReset}
        onCancel={() => setShowResetModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  sections: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
});
