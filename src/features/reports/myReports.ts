/**
 * My Reports - the signed-in person's OWN Feedback 2.0 submissions, as
 * get_my_feedback() returns them: no message body, diagnostics, email,
 * screenshot path or user id - and no admin-only data. One record shared
 * with the admin inbox (status set there is what the reporter sees).
 */

export const REPORT_STATUSES = ['received', 'under_review', 'resolved', 'closed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type MyReportRow = {
  id: string;
  created_at: string;
  category: string;
  content_type: string | null;
  content_id: string | null;
  status: string;
  status_updated_at: string | null;
  public_response: string | null;
};

export type MyReport = { id: string; createdAt: string; category: string; content: { type: string; id: string } | null; status: ReportStatus; statusUpdatedAt: string | null; publicResponse: string | null };

/** Untrusted rows -> safe view. Unknown statuses read as 'received' (never invented progress). */
export function toMyReports(rows: readonly MyReportRow[]): MyReport[] {
  return rows
    .filter((row) => typeof row.id === 'string' && !Number.isNaN(Date.parse(row.created_at)))
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      category: row.category,
      content: row.content_type && row.content_id ? { type: row.content_type, id: row.content_id } : null,
      status: (REPORT_STATUSES as readonly string[]).includes(row.status) ? (row.status as ReportStatus) : 'received',
      statusUpdatedAt: row.status_updated_at,
      publicResponse: row.public_response?.trim() || null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The status feature isn't deployed yet (function missing). */
export function isStatusUnavailable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'PGRST202' || code === '42883';
}
