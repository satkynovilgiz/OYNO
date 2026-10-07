# Learning backup - format, compatibility, import guarantees (2026-10-06)

Code: `src/features/settings/dataPrivacy/` (`learningExport.ts`,
`learningImport.ts`, `applyLearningImport.ts`, `ImportBackupScreen.tsx`).
Tests: `learningImport.test.ts`, `learningImportSafety.test.ts`,
`e2e/tests/backup-import.spec.ts`.

## Format

One JSON object, UTF-8 (a leading byte-order mark is accepted), at most 2 MB.

| Field | Meaning |
| --- | --- |
| `schema` = `"oyno-learning-export"`, `version` = `1` | Current marker. |
| `format` = `"oyno-learning-data/1"` | Earlier marker; a file with only this is read as version 1. |
| `exportedAt` | ISO time. Rejected if more than 24 h in the future. |
| `domains` | Informational list; ignored on import. |
| `readingProgress`, `highlights`, `collections`, `challengeReview`, `glossaryStudy`, `gameRecords`, `komuzFavorites`, `learningPathSteps`, `listening`, `weeklyGoal` | The data. Any may be missing. |

The export format is unchanged by this audit (no migration was needed).

## Compatibility

| File | Result |
| --- | --- |
| version 1 (either marker) | Imported. |
| `version` > 1 | Refused: "created by a newer OYNO version". |
| Other / missing schema, arbitrary JSON, arrays | Refused: "isn't an OYNO learning-data backup". |
| Unknown top-level data key (e.g. `journal`) | Refused as damaged - no partial import. |
| Sign-in / identity keys (`token`, `session`, `email`, `userId`, `owner`, ...) | Ignored and counted in the preview; never imported. |
| Any record failing its domain's validator, prototype keys, > 5000 items, strings > 5000 chars, depth > 8 | Whole file refused. |

## Import guarantees

1. **Validation first.** The whole file is parsed and every record validated
   before any store is read for planning; a refused file changes nothing.
2. **Preview = plan.** The preview is a dry run of the same merge the import
   runs: per kind of data, how many records are new, updated, already here,
   skipped (deleted on this account earlier) and how many existing records
   stay untouched. The result screen reports what actually happened and
   says so if the data changed between preview and import.
3. **Merge only.** Private Cloud Sync's domain rules: furthest reading point,
   best score, newest weekly goal, union of collection items. Counters use
   the backup as the shared base, so importing twice never adds twice.
   Re-importing your own fresh export changes nothing (reading keeps its
   resume point unless the backup is newer).
4. **One import at a time.** Repeated taps, or a second screen, get "already
   running".
5. **Owner binding.** The owner is the signed-in account (or guest) when the
   file was chosen and when Import was confirmed - never an id in the file.
   An account change while reading the file, planning, or just before
   writing aborts with nothing written.
6. **Applied in memory all-or-nothing; persisted with verification, not
   atomically.** Each store saves itself (two with a 500 ms debounce) and
   ignores its own write errors, so an atomic write to disk across stores
   isn't possible without rewriting every store. The strategy is
   *detect + recover*:
   - every domain is merged in memory in one synchronous step; a failing
     in-memory write restores every domain already written;
   - a marker (owner + a hash of the file, no contents) is stored first;
   - after the stores have had time to save, each written store's STORED
     slice for that owner is read back and compared with memory (checked
     twice). Any mismatch: the result is "stopped partway" (never
     "imported") and the marker stays;
   - recovery = import the same file again. After a restart, the plan
     shows only what is missing. Without a restart, nothing is new but a
     store whose storage is behind is written again ("Saved again"). The
     merges are idempotent, so nothing is added or counted twice.
7. **Stores still loading.** The import waits for every affected store to
   load. A load that finishes late (e.g. the app-start one) can no longer
   overwrite a store that was loaded and written meanwhile (fixed in all
   ten stores).
8. **Interruptions.** If the app stops before the check, the marker
   remains; the next visit says the last import may not have finished.
9. **Privacy.** Analytics get only `schema_version` and `domain_count`.
   Nothing from the file is logged (checked in the failure tests).

## Limitations (not resolved here)

- Persistence is verified once, right after the import. If a store's
  storage is damaged LATER by something else, that isn't the import's to
  detect.
- If storage keeps failing, every attempt reports "stopped partway" and
  the data stays in memory for this run only; nothing is lost from what
  was already stored.
- A backup with private highlight notes must be imported with them (the
  confirmation is required); there is no "everything except notes" option.
  Stripping notes safely would need a per-record rule so a newer, note-less
  copy can't erase a note that's here.
- Journal entries, photos, downloads and settings aren't part of a backup.
