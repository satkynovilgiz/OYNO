import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { ConnectionEvidence } from './ConnectionEvidence';
import { buildMap, keepView, keyOf, layout, MAX_NODES, viewFor, type MapEdge, type MapNodeRef, type MapViewState } from './connectionMapModel';
import { contentRoute, type ConnectionContentType } from './connectionsData';
import { useConnectionContent } from './useConnectionContent';

const BASE = 320;
const NODE_R = 16;

/**
 * /culture/connections/map - the sourced connections around one article
 * (connectionMapModel.ts). The map and the list below show the same edges
 * and evidence. Selection, expanded nodes, zoom and scroll are kept while
 * a source article is open. No animation (reduced motion is the default).
 */
export function ConnectionMapScreen({ start, onPressBack }: { start: MapNodeRef; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content = useConnectionContent();
  const startKey = keyOf(start);
  const [view, setViewState] = useState<MapViewState>(() => viewFor(startKey));
  const setView = (change: Partial<MapViewState>) =>
    setViewState((current) => {
      const next = { ...current, ...change };
      keepView(startKey, next);
      return next;
    });
  const hScroll = useRef<ScrollView>(null);
  const restored = useRef(false);
  const map = useMemo(() => (content.isLoading ? null : buildMap(start, new Set(view.expanded), content.exists)), [content.isLoading, content.exists, start, view.expanded]);
  const size = BASE * view.zoom;
  const positions = useMemo(() => (map ? layout(map, size) : {}), [map, size]);
  const viewport = Math.min(width - spacing.lg * 2, 420);
  useEffect(() => {
    if (!map || restored.current) return;
    restored.current = true;
    requestAnimationFrame(() => hScroll.current?.scrollTo({ x: view.scroll.x, y: 0, animated: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const title = (key: string) => {
    const [type, ...rest] = key.split(':');
    return content.get(type as ConnectionContentType, rest.join(':'))?.title ?? null;
  };
  const relation = (edge: MapEdge) => t(`culture.connections.relation.${edge.relationKey}`);
  const edgeText = (edge: MapEdge) => `${title(edge.from) ?? t('connectionMap.unavailable')} - ${relation(edge)} → ${title(edge.to) ?? t('connectionMap.unavailable')}`;
  const selected = map?.edges.find((edge) => edge.connectionId === view.selectedEdge) ?? null;
  const select = (edge: MapEdge) => {
    setView({ selectedEdge: edge.connectionId });
    announce(edgeText(edge));
  };
  const expand = (key: string) => {
    if (view.expanded.includes(key)) return;
    setView({ expanded: [...view.expanded, key] });
    announce(t('connectionMap.expanded', { title: title(key) ?? '' }));
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('connectionMap.title')}
      </Text>
    </View>
  );
  if (!map) {
    return (
      <View style={styles.root}>
        {header}
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const startNode = map.nodes[0];

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="connection-map">
        <Text style={styles.body}>{t('connectionMap.intro', { title: title(startNode.key) ?? '' })}</Text>
        <Text style={styles.note}>{t('connectionMap.rules', { max: MAX_NODES })}</Text>
        <View style={styles.wrap}>
          <Button label={view.zoom === 1 ? t('connectionMap.zoomIn') : t('connectionMap.zoomOut')} variant="secondary" size="sm" onPress={() => setView({ zoom: view.zoom === 1 ? 1.5 : 1 })} testID="connection-map-zoom" />
          <Text style={styles.meta}>{t('connectionMap.counts', { nodes: map.nodes.length, edges: map.edges.length })}</Text>
        </View>
        {map.hidden ? <Text style={styles.meta} testID="connection-map-hidden">{t('connectionMap.hidden', { count: map.hidden })}</Text> : null}

        <ScrollView ref={hScroll} horizontal style={{ width: viewport, alignSelf: 'center' }} onScroll={(e) => keepView(startKey, { ...view, scroll: { x: e.nativeEvent.contentOffset.x, y: 0 } })} scrollEventThrottle={64} focusable accessibilityLabel={t('connectionMap.viewportA11y')} testID="connection-map-viewport">
          <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={size} height={size}>
              {map.edges.map((edge) => {
                const a = positions[edge.from];
                const b = positions[edge.to];
                if (!a || !b) return null;
                const on = edge.connectionId === view.selectedEdge;
                const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const ux = (b.x - a.x) / len;
                const uy = (b.y - a.y) / len;
                const tip = { x: b.x - ux * NODE_R, y: b.y - uy * NODE_R };
                const arrow = `${tip.x},${tip.y} ${tip.x - ux * 8 - uy * 4},${tip.y - uy * 8 + ux * 4} ${tip.x - ux * 8 + uy * 4},${tip.y - uy * 8 - ux * 4}`;
                const stroke = on ? colors.accentTerracotta : colors.textSecondary;
                return (
                  <Svg key={edge.connectionId}>
                    <Line x1={a.x} y1={a.y} x2={tip.x} y2={tip.y} stroke={stroke} strokeWidth={on ? 3 : 1.5} strokeDasharray={edge.reverseLabel ? undefined : '5 3'} />
                    <Polygon points={arrow} fill={stroke} />
                  </Svg>
                );
              })}
              {map.nodes.map((node) => {
                const p = positions[node.key];
                return p ? <Circle key={node.key} cx={p.x} cy={p.y} r={NODE_R} fill={node.available ? (node.depth === 0 ? colors.primary : colors.surfaceElevated) : colors.surfaceMuted} stroke={node.available ? colors.primary : colors.textMuted} strokeWidth={2} strokeDasharray={node.available ? undefined : '3 2'} /> : null;
              })}
            </Svg>
            {map.nodes.map((node) => {
              const p = positions[node.key];
              if (!p) return null;
              return (
                <View key={node.key} style={[styles.nodeLabel, { left: p.x - 50, top: p.y + NODE_R + 2 }]} pointerEvents="none">
                  <Text style={styles.nodeText} numberOfLines={2}>
                    {title(node.key) ?? t('connectionMap.unavailable')}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.meta}>{t('connectionMap.legend')}</Text>

        {selected ? (
          <View style={styles.panel} testID="connection-map-evidence" accessibilityLiveRegion="polite">
            <Text style={styles.cardTitle}>{edgeText(selected)}</Text>
            <Text style={styles.meta}>{selected.reverseLabel ? t('connectionMap.reverseOk', { label: t(`culture.connections.relation.${selected.reverseLabel}`) }) : t('connectionMap.oneWay')}</Text>
            <ConnectionEvidence connection={selected.connection} sourceTitle={content.get(selected.connection.source.contentType, selected.connection.source.contentId)?.title ?? null} />
            {content.exists(selected.connection.source.contentType, selected.connection.source.contentId) ? (
              <Button label={t('connectionMap.openSource')} variant="secondary" size="sm" onPress={() => router.push(`${contentRoute(selected.connection.source.contentType, selected.connection.source.contentId)}?section=${encodeURIComponent(selected.connection.source.field)}` as never)} testID="connection-map-open-source" />
            ) : (
              <Text style={styles.warn}>{t('connectionMap.sourceUnavailable')}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.meta}>{t('connectionMap.pickOne')}</Text>
        )}

        <Text style={styles.section} accessibilityRole="header">
          {t('connectionMap.objectsTitle')}
        </Text>
        {map.nodes.map((node) => (
          <View key={node.key} style={styles.row} testID={`connection-map-node-${node.id}`}>
            <Text style={[styles.body, styles.flex]}>
              {title(node.key) ?? t('connectionMap.unavailable')}
              {node.depth === 0 ? ` · ${t('connectionMap.start')}` : ''}
            </Text>
            {node.expandable ? <Button label={t('connectionMap.expand')} variant="secondary" size="sm" accessibilityHint={t('connectionMap.expandA11y', { title: title(node.key) ?? '' })} onPress={() => expand(node.key)} testID={`connection-map-expand-${node.id}`} /> : null}
            {!node.available ? <Text style={styles.meta}>{t('connectionMap.notOnDevice')}</Text> : null}
          </View>
        ))}

        <Text style={styles.section} accessibilityRole="header">
          {t('connectionMap.listTitle')}
        </Text>
        {map.edges.map((edge, index) => (
          <AnimatedPressable key={edge.connectionId} style={[styles.card, edge.connectionId === view.selectedEdge && styles.cardOn]} onPress={() => select(edge)} accessibilityRole="button" accessibilityState={{ selected: edge.connectionId === view.selectedEdge }} accessibilityLabel={`${index + 1}. ${edgeText(edge)}. ${edge.reverseLabel ? '' : t('connectionMap.oneWay')}`} testID={`connection-map-edge-${edge.connectionId}`}>
            <Text style={styles.body}>
              {index + 1}. {edgeText(edge)}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              “{edge.connection.evidence}”
            </Text>
          </AnimatedPressable>
        ))}
        <Text style={styles.meta}>{t('connectionMap.personalNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.sm },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  panel: { gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.accentTerracotta },
  card: { gap: 2, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardOn: { borderColor: colors.accentTerracotta, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  nodeLabel: { position: 'absolute', width: 100, alignItems: 'center' },
  nodeText: { ...textStyles.small, fontSize: 11, color: colors.textPrimary, textAlign: 'center' },
});
