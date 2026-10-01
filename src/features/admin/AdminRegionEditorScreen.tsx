import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronLeft, Lock, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton } from '@/components/ui';
import { regionalChallengeQuestionIds, MIN_REGIONAL_QUESTIONS } from '@/features/challenges/regionalChallenges';
import { ILLUSTRATED_MAP_COORDINATES } from '@/features/explore/map/illustratedMap';
import { listRegionExperiences } from '@/features/explore/regions/regionExperiences';
import { useRegionExperiences } from '@/features/explore/regions/useRegionExperiences';
import { GUIDED_QUESTS } from '@/features/quests/questsData';
import { trails } from '@/features/trails/trailsData';
import { callAdminRpc, CONTENT_EDITOR_ROLES, useAdminRole } from '@/services/admin/adminService';
import { useRegionIntros, useRegionLinks } from '@/services/content/regionLinksService';
import { colors, radii, spacing, typography } from '@/theme';

import { coverageFor, type LanguageCoverage } from './adminModel';
import {
  addItem,
  DRAFT_FIELDS,
  draftFromConfig,
  draftToLinks,
  invalidateRegionCuration,
  INTRO_MAX,
  isDraftDirty,
  moveItem,
  regionSaveErrorMessage,
  removeItem,
  validateIntro,
  validateRegionDraft,
  type DraftField,
  type RegionDraft,
} from './regionCurator';
import { ADMIN_SECTIONS, type AdminRow } from './sections';
import { useAdminTranslations } from './useAdminData';

const LANGUAGES = ['kg', 'ru', 'en'] as const;
type Language = (typeof LANGUAGES)[number];

const TABLE_OF: Partial<Record<DraftField, 'explore_regions' | 'discoveries' | 'culture_items' | 'culture_materials'>> = {
  destinationIds: 'explore_regions',
  discoveryIds: 'discoveries',
  cultureItemIds: 'culture_items',
  materialIds: 'culture_materials',
};
const CONTENT_TYPE_OF = { destinationIds: 'explore_region', cultureItemIds: 'culture_item', materialIds: 'culture_material' } as const;

type Option = { id: string; title: string; status: string[] };

/**
 * /admin/regions/[id] - curate one Region Hub: add, remove and reorder
 * links to EXISTING content (searchable pickers), and edit the KG/RU/EN
 * intro. The region's own place is locked first. Hero, challenge pack and
 * progress rules are shown read-only. Saving goes through the admin RPCs
 * (role checked on the server, audited); leaving with unsaved edits asks
 * first.
 */
export function AdminRegionEditorScreen({ regionId, onPressBack }: { regionId: string; onPressBack: () => void }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const configs = useRegionExperiences();
  const config = configs.find((candidate) => candidate.id === regionId) ?? null;
  const linksQuery = useRegionLinks();
  const introsQuery = useRegionIntros();
  const { data: translations } = useAdminTranslations(true);
  const { data: role } = useAdminRole();
  // Moderators/analytics viewers can look; only content editors save (the
  // server enforces the same rule).
  const canEdit = !!role && CONTENT_EDITOR_ROLES.includes(role);

  const tables = ['explore_regions', 'discoveries', 'culture_items', 'culture_materials'] as const;
  const results = useQueries({
    queries: tables.map((table) => ({ queryKey: ['admin_section', table], queryFn: ADMIN_SECTIONS.find((section) => section.id === table)!.fetch })),
  });
  const rowsOf = (table: (typeof tables)[number]) => results[tables.indexOf(table)]?.data as AdminRow[] | undefined;

  const [saved, setSaved] = useState<RegionDraft | null>(null);
  const [draft, setDraft] = useState<RegionDraft | null>(null);
  const [savedIntros, setSavedIntros] = useState<Record<Language, string> | null>(null);
  const [intros, setIntros] = useState<Record<Language, string>>({ kg: '', ru: '', en: '' });
  const [search, setSearch] = useState<Partial<Record<DraftField, string>>>({});
  const [message, setMessage] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  // Start from what the app shows today (curated rows, else built-in links)
  // once the curated rows have loaded.
  useEffect(() => {
    if (!config || saved || linksQuery.isLoading) return;
    const initial = draftFromConfig(config);
    setSaved(initial);
    setDraft(initial);
  }, [config, saved, linksQuery.isLoading]);
  useEffect(() => {
    if (savedIntros || introsQuery.isLoading) return;
    const initial = Object.fromEntries(LANGUAGES.map((language) => [language, introsQuery.data?.find((row) => row.region_id === regionId && row.language === language)?.intro ?? ''])) as Record<Language, string>;
    setSavedIntros(initial);
    setIntros(initial);
  }, [introsQuery.data, introsQuery.isLoading, savedIntros, regionId]);

  const introsDirty = !!savedIntros && LANGUAGES.some((language) => savedIntros[language].trim() !== intros[language].trim());
  const dirty = (!!saved && !!draft && isDraftDirty(saved, draft)) || introsDirty;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirtyRef.current) return;
        event.preventDefault();
        setPendingLeave(() => () => navigation.dispatch(event.data.action));
      }),
    [navigation],
  );

  const catalog = useMemo(() => {
    const ids = (table: (typeof tables)[number]) => {
      const rows = rowsOf(table);
      return rows ? new Set(rows.map((row) => String(row.id))) : undefined;
    };
    const discoveries = rowsOf('discoveries');
    return {
      destinationIds: ids('explore_regions'),
      discoveryRegion: discoveries ? new Map(discoveries.map((row) => [String(row.id), (row.region_id as string | null) ?? null])) : undefined,
      cultureItemIds: ids('culture_items'),
      materialIds: ids('culture_materials'),
      trailIds: new Set(trails.map((trail) => trail.id)),
      questIds: new Set(GUIDED_QUESTS.map((quest) => quest.id)),
      supportedRegionIds: new Set(listRegionExperiences().map((region) => region.id)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((result) => result.dataUpdatedAt).join()]);

  const problems = draft ? validateRegionDraft(regionId, draft, catalog, configs) : [];
  const introProblems = LANGUAGES.flatMap((language) => {
    const problem = validateIntro(intros[language]);
    return problem ? [`${language.toUpperCase()} intro: ${problem}`] : [];
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft || !savedIntros) return;
      if (saved && isDraftDirty(saved, draft)) await callAdminRpc('admin_set_region_links', { p_region_id: regionId, p_links: draftToLinks(regionId, draft) });
      for (const language of LANGUAGES) {
        if (savedIntros[language].trim() !== intros[language].trim()) await callAdminRpc('admin_set_region_intro', { p_region_id: regionId, p_language: language, p_intro: intros[language].trim() });
      }
    },
    onSuccess: async () => {
      setSaved(draft);
      setSavedIntros({ ...intros });
      setMessage({ kind: 'saved', text: 'Saved. The Region Hub, Explore, Home, Passport and map now use these links.' });
      await invalidateRegionCuration(queryClient);
    },
    onError: async (error) => {
      setMessage({ kind: 'error', text: regionSaveErrorMessage(error) });
      // A partial save (links saved, an intro failed) must not look unsaved-then-lost.
      await invalidateRegionCuration(queryClient);
    },
  });

  if (!config) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.note}>Unknown region "{regionId}". Only the supported regions can be curated.</Text>
        <Button label="Back" variant="secondary" onPress={onPressBack} />
      </View>
    );
  }

  const regionRow = rowsOf('explore_regions')?.find((row) => row.id === regionId);
  const challengeCount = regionalChallengeQuestionIds(draft ? { ...config, ...draft } : config).length;

  function optionFor(field: DraftField, id: string): Option {
    if (field === 'trailIds') {
      const trail = trails.find((candidate) => candidate.id === id);
      return { id, title: trail?.title.en ?? id, status: trail ? [`${trail.steps.length} steps`] : ['missing'] };
    }
    if (field === 'questIds') {
      const quest = GUIDED_QUESTS.find((candidate) => candidate.id === id);
      return { id, title: quest?.title.en ?? id, status: quest ? [`${quest.steps.length} steps`] : ['missing'] };
    }
    const table = TABLE_OF[field]!;
    const rows = rowsOf(table);
    const row = rows?.find((candidate) => candidate.id === id);
    if (!row) return { id, title: id, status: rows ? ['missing'] : ['loading'] };
    const title = String(row.name_en || row.name_kg || row.title_en || row.title_kg || row.title || id);
    const status: string[] = [];
    const verification = row.accuracy_level ?? row.status;
    if (verification) status.push(String(verification).replace('_', ' '));
    const sources = Array.isArray(row.sources) ? row.sources.length : 0;
    status.push(`${sources} source${sources === 1 ? '' : 's'}`);
    const contentType = CONTENT_TYPE_OF[field as keyof typeof CONTENT_TYPE_OF];
    if (contentType) status.push(coverageLabel(coverageFor(contentType, row, translations ?? [])));
    if (field === 'destinationIds') status.push(ILLUSTRATED_MAP_COORDINATES[id] ? 'on map' : 'no map pin');
    if (field === 'discoveryIds' && row.region_id !== regionId) status.push(`region: ${String(row.region_id ?? 'none')}`);
    return { id, title, status };
  }

  function candidates(field: DraftField): Option[] {
    const query = (search[field] ?? '').trim().toLowerCase();
    if (!query || !draft) return [];
    const ids =
      field === 'trailIds'
        ? trails.map((trail) => trail.id)
        : field === 'questIds'
          ? GUIDED_QUESTS.map((quest) => quest.id)
          : (rowsOf(TABLE_OF[field]!) ?? []).filter((row) => field !== 'discoveryIds' || row.region_id === regionId).map((row) => String(row.id));
    return ids
      .filter((id) => !draft[field].includes(id))
      .map((id) => optionFor(field, id))
      .filter((option) => option.id.toLowerCase().includes(query) || option.title.toLowerCase().includes(query))
      .slice(0, 8);
  }

  const update = (field: DraftField, next: string[]) => {
    setDraft((current) => (current ? { ...current, [field]: next } : current));
    setMessage(null);
  };

  const canSave = canEdit && dirty && problems.length === 0 && introProblems.length === 0 && !save.isPending;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title} numberOfLines={1}>
          {String(regionRow?.name_en ?? regionId)}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {!draft ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.groupTitle}>Read-only (set in the app)</Text>
            <Text style={styles.meta}>Hero: {config.heroImage ? 'region photo' : 'region colour (no photo)'}</Text>
            <Text style={styles.meta}>
              Regional challenge: {challengeCount >= MIN_REGIONAL_QUESTIONS ? `available (${challengeCount} sourced questions)` : `not shown (${challengeCount} of ${MIN_REGIONAL_QUESTIONS} sourced questions with these links)`}
            </Text>
            <Text style={styles.meta}>Progress counts places visited, discoveries found, trail stops and quest steps. Culture links don't count.</Text>
          </View>

          {DRAFT_FIELDS.map(({ field, label }) => {
            const list = draft[field];
            const locked = field === 'destinationIds';
            return (
              <View key={field} style={styles.card}>
                <Text style={styles.groupTitle} accessibilityRole="header">
                  {label} ({list.length})
                </Text>
                {list.length === 0 ? <Text style={styles.meta}>None linked - this section is hidden in the hub.</Text> : null}
                {list.map((id, index) => {
                  const option = optionFor(field, id);
                  const isRegion = locked && index === 0;
                  return (
                    <View key={id} style={styles.item}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{option.title}</Text>
                        <Text style={[styles.meta, option.status.includes('missing') && styles.errorText]}>
                          {id} · {option.status.join(' · ')}
                        </Text>
                      </View>
                      {isRegion ? (
                        <Lock size={16} color={colors.textMuted} accessibilityLabel="The region itself stays first" />
                      ) : (
                        <>
                          <IconButton icon={ArrowUp} size={32} iconSize={14} elevated={false} accessibilityLabel={`Move ${option.title} up`} onPress={() => update(field, moveItem(list, index, -1, locked))} />
                          <IconButton icon={ArrowDown} size={32} iconSize={14} elevated={false} accessibilityLabel={`Move ${option.title} down`} onPress={() => update(field, moveItem(list, index, 1, locked))} />
                          <IconButton icon={X} size={32} iconSize={14} elevated={false} accessibilityLabel={`Remove ${option.title}`} onPress={() => update(field, removeItem(list, index, locked))} />
                        </>
                      )}
                    </View>
                  );
                })}
                <TextInput
                  style={styles.input}
                  placeholder={`Add ${label.toLowerCase()} - search by title or id`}
                  placeholderTextColor={colors.textMuted}
                  value={search[field] ?? ''}
                  onChangeText={(text) => setSearch((current) => ({ ...current, [field]: text }))}
                  accessibilityLabel={`Search ${label}`}
                  autoCapitalize="none"
                />
                {candidates(field).map((option) => (
                  <AnimatedPressable
                    key={option.id}
                    style={styles.candidate}
                    onPress={() => {
                      update(field, addItem(list, option.id));
                      setSearch((current) => ({ ...current, [field]: '' }));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${option.title}`}
                  >
                    <Text style={styles.itemTitle}>+ {option.title}</Text>
                    <Text style={styles.meta}>
                      {option.id} · {option.status.join(' · ')}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            );
          })}

          <View style={styles.card}>
            <Text style={styles.groupTitle} accessibilityRole="header">
              Intro (optional override, max {INTRO_MAX})
            </Text>
            <Text style={styles.meta}>Empty = the app's built-in intro for that language.</Text>
            {LANGUAGES.map((language) => (
              <View key={language} style={{ gap: 4 }}>
                <Text style={styles.itemTitle}>
                  {language.toUpperCase()} · {intros[language].trim().length}/{INTRO_MAX}
                </Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  value={intros[language]}
                  onChangeText={(text) => {
                    setIntros((current) => ({ ...current, [language]: text }));
                    setMessage(null);
                  }}
                  accessibilityLabel={`${language.toUpperCase()} intro`}
                />
              </View>
            ))}
          </View>

          {[...problems, ...introProblems].length > 0 ? (
            <View style={styles.card} accessibilityLiveRegion="polite">
              <Text style={[styles.groupTitle, styles.errorText]}>Fix before saving</Text>
              {[...problems, ...introProblems].map((problem) => (
                <Text key={problem} style={[styles.meta, styles.errorText]}>
                  • {problem}
                </Text>
              ))}
            </View>
          ) : null}
          {message ? (
            <Text style={[styles.meta, message.kind === 'error' ? styles.errorText : styles.savedText]} accessibilityLiveRegion="polite">
              {message.text}
            </Text>
          ) : null}
          {!canEdit ? <Text style={styles.meta}>Your role can view regions but not edit them.</Text> : null}
          <Button label={save.isPending ? 'Saving…' : dirty ? 'Save region' : 'No changes'} onPress={() => save.mutate()} disabled={!canSave} />
        </ScrollView>
      )}

      <ConfirmationModal
        visible={!!pendingLeave}
        title="Discard changes?"
        message="This region has unsaved edits."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const leave = pendingLeave;
          dirtyRef.current = false;
          setPendingLeave(null);
          leave?.();
        }}
      />
    </View>
  );
}

function coverageLabel(coverage: LanguageCoverage): string {
  const short = { complete: '✓', partial: '½', missing: '–' } as const;
  return `KG ${short[coverage.kg]} RU ${short[coverage.ru]} EN ${short[coverage.en]}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  card: { gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  groupTitle: { ...typography.overline, color: colors.accentTerracotta },
  note: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: { ...typography.small, color: colors.textSecondary },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceBorder },
  itemTitle: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  input: { ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  candidate: { paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, gap: 2 },
  errorText: { color: colors.error },
  savedText: { color: colors.primary, fontWeight: '700' },
});
