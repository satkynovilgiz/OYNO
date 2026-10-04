import { describeSource, normalizeVerification, type SourceInfo, type VerificationLevel } from '@/services/content/verification';

/**
 * Source Explorer - makes the EXISTING sources + verification readable.
 * It never changes a verification level, never fetches or scrapes a
 * source, and never decides which source supports which claim: OYNO stores
 * no source-to-field mapping, so sources are presented as supporting the
 * story as a whole. Publisher names/kinds come from the existing curated
 * host list (verification.ts); anything else is shown by its address.
 */

export type ExplorerSource = { kind: 'link'; id: string; info: SourceInfo } | { kind: 'unavailable'; id: string };

/** Every recorded entry, in order - a malformed / non-web entry is listed as "Source unavailable", never linked. */
export function explorerSources(raw: readonly string[] | null | undefined): ExplorerSource[] {
  const seen = new Set<string>();
  const out: ExplorerSource[] = [];
  (raw ?? []).forEach((entry, index) => {
    const info = describeSource(entry);
    if (!info) {
      out.push({ kind: 'unavailable', id: `s${index + 1}` });
      return;
    }
    if (seen.has(info.url)) return;
    seen.add(info.url);
    out.push({ kind: 'link', id: `s${index + 1}`, info });
  });
  return out;
}

/** Only http(s) URLs may be opened. */
export function safeExternalUrl(raw: string): string | null {
  return describeSource(raw)?.url ?? null;
}

/** Fixed explanations per EXISTING state - nothing computed from the sources. */
export function explanationKey(level: string | null | undefined): { level: VerificationLevel; key: string } {
  const normalized = normalizeVerification(level);
  return { level: normalized, key: `sourceExplorer.why.${normalized}` };
}

/** No explicit source-to-field mapping exists in OYNO's data (v1). */
export const FIELD_MAPPINGS_AVAILABLE = false;

export function sourceExplorerRoute(type: 'culture_item' | 'culture_material', id: string): string {
  return type === 'culture_item' ? `/culture/item/${id}/sources` : `/culture/material/${id}/sources`;
}
