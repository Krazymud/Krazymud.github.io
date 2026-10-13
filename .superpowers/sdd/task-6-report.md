# Task 6 report
- `absorbWebDoc(working, webDoc, dek, clock, loadBlob?)` in working.ts. The optional 5th arg loads published list blobs so checks can be applied by source+index.
- Notes/lists become `web/notes/<id>` / `web/lists/<id>` with the web record's updatedAt; newer working records win; web tombstones become tombstones.
- Checks write `done` into a new list blob (only newer than known updatedAt).
- `readWebFileText` added to gitVault.ts (reuses github.readRemote). The hook reads remote web.json plus the old pending doc, absorbs, and commits with `deleteWebJson: true` only when the remote file exists. After a successful commit it clears old web pending/synced keys.
- Tests: 3 working unit tests, 2 hook tests. Full suite 636 passing, tsc clean.

## Follow-up: IDB-only legacy pending

- `webMigratedRef` tracks successful absorb during hydration; after commit, `clearPending` / `clearSynced` run when migration occurred, not only when `deleteWebJson` was set (`webJsonRef`).
- Hook test: legacy IDB pending with no remote `web.json` still commits absorbed content and clears old web keys.
