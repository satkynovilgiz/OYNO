/**
 * Structured context for a content report - WHICH content, in which
 * language, plus the reporter's optional suggested correction and source
 * link. Only public content identifiers go here: no titles typed by the
 * user, no journal text, search queries or account data.
 */

export type ReportContentType = 'culture_item' | 'culture_material' | 'explore_region' | 'discovery' | 'collection' | 'trail' | 'game';

export type ReportContent = {
  contentType: ReportContentType;
  contentId: string;
  language: 'kg' | 'ru' | 'en';
  suggestedCorrection?: string;
  sourceUrl?: string;
};

export const MAX_CORRECTION_LENGTH = 2000;
export const MAX_SOURCE_URL_LENGTH = 500;

const CONTENT_ID = /^[a-z0-9][a-z0-9_-]{0,119}$/;

/** Basic shape only: http(s), a dotted host, no spaces. The app never opens it. */
export function isValidReportUrl(value: string): boolean {
  const url = value.trim();
  if (!url || url.length > MAX_SOURCE_URL_LENGTH) return false;
  if (!/^https?:\/\/[^\s/?#]+\.[^\s]+$/i.test(url)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** Categories that carry content context (when opened from content). */
export const CONTENT_CATEGORIES = new Set(['culture_correction', 'translation', 'image']);

/**
 * The context actually sent: dropped entirely when the report isn't about
 * content, the id isn't a plain public id, or the category doesn't use it;
 * correction/source only for "incorrect cultural information".
 */
export function buildReportContent(
  category: string,
  context: { contentType: ReportContentType; contentId: string } | null | undefined,
  input: { language: string; suggestedCorrection?: string; sourceUrl?: string },
): ReportContent | null {
  if (!context || !CONTENT_CATEGORIES.has(category) || !CONTENT_ID.test(context.contentId)) return null;
  const language = input.language === 'ru' || input.language === 'en' ? input.language : 'kg';
  const content: ReportContent = { contentType: context.contentType, contentId: context.contentId, language };
  if (category === 'culture_correction') {
    const correction = input.suggestedCorrection?.trim().slice(0, MAX_CORRECTION_LENGTH);
    if (correction) content.suggestedCorrection = correction;
    const url = input.sourceUrl?.trim();
    if (url && isValidReportUrl(url)) content.sourceUrl = url;
  }
  return content;
}

/** The p_content object for submit_beta_feedback_v2 (snake_case, allow-listed). */
export function toServerContent(content: ReportContent | null | undefined): Record<string, string> {
  if (!content) return {};
  const out: Record<string, string> = { content_type: content.contentType, content_id: content.contentId, language: content.language };
  if (content.suggestedCorrection) out.suggested_correction = content.suggestedCorrection;
  if (content.sourceUrl) out.source_url = content.sourceUrl;
  return out;
}

/**
 * For a server that doesn't have submit_beta_feedback_v2 yet: the nearest
 * old category, and the context folded into the message so nothing the
 * reporter wrote is lost.
 */
export function legacyCategory(category: string): string {
  if (category === 'culture_correction') return 'content';
  if (category === 'image') return 'ui';
  if (category === 'suggestion') return 'other';
  return category;
}

export function legacyMessage(message: string, content: ReportContent | null | undefined): string {
  if (!content) return message;
  const lines = [message.trim(), '', `[${content.contentType}:${content.contentId} · ${content.language}]`];
  if (content.suggestedCorrection) lines.push(`Suggested: ${content.suggestedCorrection}`);
  if (content.sourceUrl) lines.push(`Source: ${content.sourceUrl}`);
  return lines.join('\n').slice(0, 4000);
}
