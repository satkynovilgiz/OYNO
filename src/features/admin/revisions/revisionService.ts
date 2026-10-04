import { supabase } from '@/services/supabase/client';

import { parseRevisionRows, type AuthoredFields, type RevisionContentType, type RevisionRow, type RevisionSnapshot } from './revisionModel';

/** Thin RPC wrappers - every one is authorized server-side (require_admin_role). */
export async function listRevisions(type: RevisionContentType, id: string): Promise<RevisionRow[]> {
  const { data, error } = await supabase.rpc('admin_list_content_revisions', { p_content_type: type, p_content_id: id });
  if (error) throw error;
  return parseRevisionRows(data);
}

export async function getRevision(type: RevisionContentType, id: string, revision: number): Promise<RevisionSnapshot> {
  const { data, error } = await supabase.rpc('admin_get_content_revision', { p_content_type: type, p_content_id: id, p_revision_number: revision });
  if (error) throw error;
  const snapshot = (data ?? {}) as Partial<RevisionSnapshot>;
  return { fields: snapshot.fields ?? {}, translations: Array.isArray(snapshot.translations) ? snapshot.translations : [] };
}

export type DraftRow = { fields: AuthoredFields; baseRevision: number; updatedAt: string; isMine: boolean };
export async function getDraft(type: RevisionContentType, id: string): Promise<DraftRow | null> {
  const { data, error } = await supabase.rpc('admin_get_content_draft', { p_content_type: type, p_content_id: id });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row || !row.fields || typeof row.fields !== 'object') return null;
  return { fields: row.fields as AuthoredFields, baseRevision: Number(row.base_revision) || 0, updatedAt: String(row.updated_at ?? ''), isMine: row.is_mine === true };
}

export async function saveDraft(type: RevisionContentType, id: string, fields: AuthoredFields, baseRevision: number): Promise<void> {
  const { error } = await supabase.rpc('admin_save_content_draft', { p_content_type: type, p_content_id: id, p_fields: fields, p_base_revision: baseRevision });
  if (error) throw error;
}

export async function discardDraft(type: RevisionContentType, id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_discard_content_draft', { p_content_type: type, p_content_id: id });
  if (error) throw error;
}

/** Returns the new revision number. Never sends an editor id. */
export async function publishContent(type: RevisionContentType, id: string, fields: AuthoredFields, expectedRevision: number): Promise<number> {
  const { data, error } = await supabase.rpc('admin_publish_content', { p_content_type: type, p_content_id: id, p_fields: fields, p_expected_revision: expectedRevision });
  if (error) throw error;
  return Number(data);
}

export async function restoreRevision(type: RevisionContentType, id: string, revision: number, expectedRevision: number): Promise<number> {
  const { data, error } = await supabase.rpc('admin_restore_revision', { p_content_type: type, p_content_id: id, p_revision_number: revision, p_expected_revision: expectedRevision });
  if (error) throw error;
  return Number(data);
}
