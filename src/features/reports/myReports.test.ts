import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { isStatusUnavailable, REPORT_STATUSES, toMyReports, type MyReportRow } from './myReports';

const sql = fs.readFileSync(path.join(__dirname, '../../../supabase/migrations/20261003000002_feedback_status.sql'), 'utf8').replace(/--[^\n]*/g, '');
const fn = (name: string) => sql.slice(sql.indexOf(`create function public.${name}`), sql.indexOf('$$;', sql.indexOf(`create function public.${name}`)));
const row = (fields: Partial<MyReportRow> = {}): MyReportRow => ({ id: 'r1', created_at: '2026-10-01T10:00:00Z', category: 'culture_correction', content_type: 'culture_item', content_id: 'boz-uy-overview', status: 'received', status_updated_at: null, public_response: null, ...fields });

describe('My Reports', () => {
  it('owner-only: get_my_feedback reads only auth.uid()’s rows (no parameter to ask for another user)', () => {
    const own = fn('get_my_feedback');
    expect(own).toMatch(/security definer set search_path = public/);
    expect(own).toMatch(/where auth\.uid\(\) is not null and f\.user_id = auth\.uid\(\)/);
    expect(own).toMatch(/create function public\.get_my_feedback\(\)/);
    expect(sql).toMatch(/revoke execute on function public\.get_my_feedback\(\) from public, anon/);
    // The table still has no client read policy.
    expect(sql).not.toMatch(/create policy/);
  });

  it('never returns message bodies, diagnostics, email, screenshot or user id to the reporter list', () => {
    const own = fn('get_my_feedback');
    const returned = own.slice(own.indexOf('returns table'), own.indexOf('language'));
    expect(returned).not.toMatch(/message|diagnostics|screenshot|user_id|email|suggested_correction/);
    expect(returned).toMatch(/public_response/);
  });

  it('admin data stays admin: status changes require an admin role and are audited; no private notes exist', () => {
    const set = fn('admin_set_feedback_status');
    expect(set).toMatch(/require_admin_role\(array\['super_admin', 'content_editor', 'moderator'\]\)/);
    expect(set).toMatch(/insert into public\.admin_audit_log/);
    expect(fn('admin_get_feedback_statuses')).toMatch(/require_admin_role/);
    expect(sql).not.toMatch(/admin_note|internal_note/);
  });

  it('status model: received / under review / resolved / closed - unknown values never become progress', () => {
    expect(REPORT_STATUSES).toEqual(['received', 'under_review', 'resolved', 'closed']);
    expect(toMyReports([row({ status: 'resolved', public_response: '  Thank you - fixed.  ' })])[0]).toMatchObject({ status: 'resolved', publicResponse: 'Thank you - fixed.' });
    expect(toMyReports([row({ status: 'escalated' })])[0].status).toBe('received');
  });

  it('one source of truth: the admin inbox writes the same record the reporter reads', () => {
    expect(fn('admin_set_feedback_status')).toMatch(/update public\.beta_feedback set status = p_status/);
    expect(fn('get_my_feedback')).toMatch(/from public\.beta_feedback f/);
    const admin = fs.readFileSync(path.join(__dirname, '../admin/AdminFeedbackScreen.tsx'), 'utf8');
    expect(admin).toMatch(/admin_set_feedback_status/);
  });

  it('deleted content: the report stays, shown as "Content unavailable"', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'MyReportsScreen.tsx'), 'utf8');
    expect(screen).toMatch(/myReports\.contentUnavailable/);
    expect(toMyReports([row({ content_id: 'gone-item' })])[0].content).toEqual({ type: 'culture_item', id: 'gone-item' });
  });

  it('guests: reports are anonymous; no list, no Profile entry, no recovery', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'MyReportsScreen.tsx'), 'utf8');
    expect(screen).toMatch(/enabled: !!userId/);
    expect(screen).toMatch(/queryKey: \['my_feedback', userId\]/);
    const profile = fs.readFileSync(path.join(__dirname, '../profile/ProfileScreen.tsx'), 'utf8');
    expect(profile).toMatch(/\.\.\.\(showMyReports \?/);
  });

  it('notifications: none are sent (no push or opt-out bypass); status is pulled when the person opens My Reports', () => {
    const files = ['MyReportsScreen.tsx', 'myReports.ts'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    expect(files).not.toMatch(/scheduleNotificationAsync|sendPush|expo-notifications/);
    expect(sql).not.toMatch(/net\.http|pg_notify|push/i);
  });

  it('migration not applied yet -> honest "not available" (function missing)', () => {
    expect(isStatusUnavailable({ code: 'PGRST202' })).toBe(true);
    expect(isStatusUnavailable({ code: '42501' })).toBe(false);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { myReports: Record<string, unknown> }).myReports;
      for (const key of ['title', 'submitted', 'contentUnavailable', 'empty']) expect(block[key]).toBeTruthy();
      for (const status of REPORT_STATUSES) expect((block.status as Record<string, string>)[status]).toBeTruthy();
    }
  });
});
