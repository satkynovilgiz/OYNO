import { router } from 'expo-router';
import { Compass, History, Palette } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AnimatedPressable, Button, ProgressBar, Skeleton } from '@/components/ui';
import { cultureCategoryImages } from '@/features/culture/data';
import { percentRead } from '@/features/culture/reading/readingModel';
import { track } from '@/services/analytics/analytics';
import { cardRadii, colors, iconSizes, spacing, textStyles } from '@/theme';

import type { HomeRecommendationDisplay } from '../useHomeRecommendation';
import { CREATE_ROUTE, DISCOVER_ROUTE, type ContinuePick, type PrimaryActionId } from './homePrimaryModel';
import type { HomeContinue } from './useHomeContinue';
import discoverArt from '@assets/img/OYNO_design/culture/boz_uy/yurt_camp.jpg';

const createArt = cultureCategoryImages.oymo;

/**
 * Home's three primary actions. Discover and Create are two distinct,
 * always-present tiles (static - they never wait for data); Continue is
 * ONE card of real unfinished work, or an honest state when there is none.
 */
export function HomePrimary({ state, journeyDisplay }: { state: HomeContinue; journeyDisplay: HomeRecommendationDisplay }) {
  const { t } = useTranslation();
  const open = (id: PrimaryActionId, route: string) => {
    track('home_primary_opened', { action: id });
    router.push(route as never);
  };
  const isNew = state.audience === 'new' && state.status === 'ready';

  return (
    <View style={styles.root} testID="home-primary">
      <Text style={styles.heading} accessibilityRole="header">
        {isNew ? t('homePrimary.newTitle') : t('homePrimary.title')}
      </Text>
      {isNew ? <Text style={styles.lead}>{t('homePrimary.newBody')}</Text> : null}
      <View style={styles.tiles}>
        <PrimaryTile
          id="discover"
          tone="discover"
          icon={<Compass size={iconSizes.md} color={colors.textOnDark} strokeWidth={2.2} />}
          image={discoverArt}
          title={t('homePrimary.discover.title')}
          body={t('homePrimary.discover.body')}
          onPress={() => open('discover', DISCOVER_ROUTE)}
          recommended={isNew}
          recommendedLabel={t('homePrimary.startHere')}
        />
        <PrimaryTile
          id="create"
          tone="create"
          icon={<Palette size={iconSizes.md} color={colors.textOnDark} strokeWidth={2.2} />}
          image={createArt}
          title={t('homePrimary.create.title')}
          body={t('homePrimary.create.body')}
          onPress={() => open('create', CREATE_ROUTE)}
        />
      </View>
      <ContinueCard state={state} journeyDisplay={journeyDisplay} onOpen={(route) => open('continue', route)} />
    </View>
  );
}

function PrimaryTile(props: { id: PrimaryActionId; tone: 'discover' | 'create'; icon: React.ReactNode; image: ImageSourcePropType; title: string; body: string; onPress: () => void; recommended?: boolean; recommendedLabel?: string }) {
  const label = `${props.title}. ${props.body}${props.recommended ? `. ${props.recommendedLabel}` : ''}`;
  return (
    <AnimatedPressable
      style={[styles.tile, props.tone === 'discover' ? styles.tileDiscover : styles.tileCreate]}
      onPress={props.onPress}
      press="soft"
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`home-primary-${props.id}`}
    >
      <Image source={props.image} style={styles.tileImage} resizeMode="cover" accessible={false} />
      {props.recommended ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{props.recommendedLabel}</Text>
        </View>
      ) : null}
      <View style={styles.tileBody}>
        <View style={styles.tileTitleRow}>
          {props.icon}
          <Text style={styles.tileTitle}>{props.title}</Text>
        </View>
        <Text style={styles.tileText}>{props.body}</Text>
      </View>
    </AnimatedPressable>
  );
}

function continueText(pick: ContinuePick, state: HomeContinue, journey: HomeRecommendationDisplay, t: (key: string, options?: Record<string, unknown>) => string) {
  switch (pick.kind) {
    case 'unsaved':
      return {
        title: pick.entryKind ? t(`recovery.kinds.${pick.entryKind}`) : t('homePrimary.continue.unsavedMany', { count: pick.count }),
        body: pick.survivesRestart ? t('homePrimary.continue.unsavedKept') : t('homePrimary.continue.unsavedMemory'),
        cta: pick.entryKind ? t('homePrimary.continue.openWork') : t('homePrimary.continue.openRecovery'),
        image: null,
        progress: null,
      };
    case 'guide':
      return {
        title: t('firstUse.cardContinueTitle'),
        body: t('firstUse.cardBody'),
        cta: t('firstUse.continue'),
        image: null,
        progress: null,
      };
    case 'reading':
      return {
        title: state.reading?.title ?? '',
        body: t('reading.percentRead', { percent: percentRead(pick.record) }),
        cta: pick.record.lastSectionKey ? t('readingCompanion.continueSection') : t('reading.continue'),
        image: state.reading?.image ?? null,
        progress: pick.record.furthest,
      };
    case 'journey': {
      const progress = pick.recommendation.progress && pick.recommendation.progress.total > 0 ? pick.recommendation.progress.completed / pick.recommendation.progress.total : null;
      return {
        title: journey.title,
        body: journey.subtitle ?? '',
        cta: journey.ctaLabel,
        image: journey.imageSource,
        progress,
      };
    }
  }
}

function ContinueCard({ state, journeyDisplay, onOpen }: { state: HomeContinue; journeyDisplay: HomeRecommendationDisplay; onOpen: (route: string) => void }) {
  const { t } = useTranslation();
  const kicker = (
    <View style={styles.kickerRow}>
      <History size={iconSizes.xs} color={colors.accentTerracottaText} strokeWidth={2.4} />
      <Text style={styles.kicker}>{t('homePrimary.continue.title')}</Text>
    </View>
  );
  if (state.status === 'checking') {
    // Shaped like the card that follows; announced once, never an endless spinner.
    return (
      <View style={styles.card} testID="home-continue-checking" accessible accessibilityLabel={t('homePrimary.continue.checking')}>
        {kicker}
        <Skeleton height={18} width="70%" />
        <Skeleton height={14} width="45%" />
      </View>
    );
  }
  const pick = state.pick;
  if (!pick) {
    return (
      <View style={[styles.card, styles.cardQuiet]} testID={`home-continue-empty-${state.audience}`}>
        {kicker}
        <Text style={styles.cardBody}>{state.audience === 'new' ? t('homePrimary.continue.emptyNew') : t('homePrimary.continue.emptyReturning')}</Text>
      </View>
    );
  }
  const text = continueText(pick, state, journeyDisplay, t);
  return (
    <View style={styles.card} testID={`home-continue-${pick.kind}`}>
      {kicker}
      <View style={styles.cardRow}>
        {text.image ? <Image source={text.image} style={styles.thumb} resizeMode="cover" accessible={false} /> : null}
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {text.title}
          </Text>
          {text.body ? <Text style={styles.cardBody}>{text.body}</Text> : null}
        </View>
      </View>
      {text.progress !== null ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('reading.progress')}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(text.progress * 100),
          }}
        >
          <ProgressBar progress={text.progress} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />
        </View>
      ) : null}
      <Button label={text.cta} onPress={() => onOpen(pick.route)} accessibilityHint={text.title} testID="home-continue-open" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  heading: { ...textStyles.h3, color: colors.textPrimary },
  lead: { ...textStyles.body, color: colors.textSecondary },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Two across on phones, one per row when text is large or the screen narrow (flexBasis wraps).
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: cardRadii.media,
    overflow: 'hidden',
    minHeight: 176,
  },
  tileDiscover: { backgroundColor: colors.surfaceFeature },
  tileCreate: { backgroundColor: colors.accentTerracottaDark },
  tileImage: { width: '100%', height: 92 },
  tileBody: { padding: spacing.sm, gap: spacing.xxs },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tileTitle: { ...textStyles.title, color: colors.textOnDark, flexShrink: 1 },
  tileText: { ...textStyles.caption, color: colors.textOnDarkSecondary },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.accentGold,
    borderRadius: cardRadii.chip,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  badgeText: { ...textStyles.small, color: colors.textPrimary },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: cardRadii.compact,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accentGold,
  },
  cardQuiet: { borderColor: colors.borderSubtle },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  kicker: { ...textStyles.overline, color: colors.accentTerracottaText },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  flex: { flex: 1, gap: spacing.xxs },
  cardTitle: { ...textStyles.title, color: colors.textPrimary },
  cardBody: { ...textStyles.caption, color: colors.textSecondary },
});
