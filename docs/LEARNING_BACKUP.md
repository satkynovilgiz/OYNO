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
6. **All or nothing in memory.** Writes are synchronous; a failing write
   restores every domain already written ("couldn't be imported, nothing
   changed"). If even the restore fails, the screen says the import stopped
   partway.
7. **Interruptions.** A marker (owner + a hash of the file, no contents) is
   stored before writing and cleared after the stores have persisted. If
   the app stops in between, the next visit says the last import may not
   have finished; importing the same file again is safe and completes it.
8. **Privacy.** Analytics get only `schema_version` and `domain_count`.
   Nothing from the file is logged.

## Limitations (not resolved here)

- The stores persist with fire-and-forget writes (two with a 500 ms
  debounce) and swallow storage errors. The import can't prove each store
  reached disk; it waits 800 ms, then clears the marker. A storage write
  that fails silently after that isn't detected. Recovery is the same:
  import the file again.
- A backup with private highlight notes must be imported with them (the
  confirmation is required); there is no "everything except notes" option.
  Stripping notes safely would need a per-record rule so a newer, note-less
  copy can't erase a note that's here.
- Journal entries, photos, downloads and settings aren't part of a backup.
