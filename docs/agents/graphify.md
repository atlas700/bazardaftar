# Graphify workflow

Use this workflow before implementing any feature and refresh the graph after
changing indexed code. Run commands from the repository root in PowerShell.
The [development workflow](development.md) still governs implementation,
review, tests, and delivery; Graphify supplies navigation context.

## Scope and defaults

- Index `src` with local AST extraction. Documentation, migrations, scripts,
  configuration, and E2E files outside `src` need direct inspection.
- Start queries with a 1,500-token budget. Narrow the terms before increasing
  it; inspect the reported truncation when deciding whether results suffice.
- Use `--code-only` for extraction and `--no-label` for clustering to avoid
  model calls. Semantic extraction, API-backed labels, cloud services, hooks,
  and background watchers require an explicit request.
- Treat graph connections as leads. Confirm current source, permissions,
  transactions, and validation before making a decision. Missing connections
  do not prove that callers or dependencies are absent.
- Keep generated `graphify-out/` files local and excluded from Git. Never put
  credentials or authentication artifacts into graph inputs or handoffs.

## Before implementing a feature

1. Read the applicable project rules, feature plan, and accepted decisions.
   Check the working tree and preserve unrelated changes.
2. Check `graphify-out/graph.json` and whether indexed source changed since its
   last successful extraction, including branch switches and uncommitted edits.
   Build a missing graph or refresh a stale one with the commands below.
   When freshness cannot be established, treat the graph as stale.
3. Use Graphify to locate the feature's existing modules, entry points, and
   relationships. When the local skill is installed, follow its query guidance
   at `.agents/skills/graphify/references/query.md` for vocabulary expansion;
   select actual graph terms instead of inventing names. This skill file is a
   local installation artifact, not part of the repository.

   ```powershell
   graphify query "<feature terms>" --budget 1500
   ```

4. Read the relevant source files and use targeted `rg` searches to verify
   callers, tests, fixtures, exports, and configuration. Resolve relative graph
   source paths against the indexed `src` root. Include dependencies outside
   the graph's scope in the implementation plan.

Finish this preparation with a concrete list of affected code and checks.
For an exact symbol or filename lookup, a targeted search is sufficient;
avoid repeated graph queries that add no context.

## During implementation

- Reuse the modules and patterns found during preparation. Query again when
  the change reaches an unfamiliar dependency or a new call path.
- The graph describes the last extraction, so inspect edited source directly
  until the next refresh. Batch refreshes after a coherent change rather than
  rebuilding after every edit.
- Preserve the repository's review and validation requirements. Graph results
  do not establish correctness, tenant isolation, or test coverage.

## After implementing a feature

1. After the final source edit, refresh the complete indexed scope:

   ```powershell
   graphify extract src --code-only --out .
   ```

   `--out .` places results in the root `graphify-out/`; passing
   `--out graphify-out` creates a nested output directory. Check extraction
   warnings for skipped files, unsupported syntax, or unexpected graph loss.
   If a shrink guard rejects an intentional deletion or rename, first confirm
   the source diff and scan scope, then repeat extraction with `--force`.

2. Only after extraction succeeds, regenerate the report and visualization
   without API-backed labeling:

   ```powershell
   graphify cluster-only . --no-label
   ```

   Clustering alone does not refresh source data. Documentation-only changes
   outside `src` need no extraction; record that the graph was unaffected.

3. Query a changed symbol or feature with the bounded query command. Verify
   that results point to current files and reflect relevant additions, renames,
   or deletions. Recheck callers in source if results are incomplete.
4. Complete the normal review and checks, then record extraction and query
   outcomes, indexed scope, and material warnings in the feature handoff.
   Refresh again if later fixes change `src`. Report token savings only when
   measured against comparable work.

## Missing tools or failures

If `graphify` is unavailable, try the installed Windows executable:
`& "$env:USERPROFILE/.local/bin/graphify.exe"` followed by the same arguments.
If the tool or local skill is not installed, report that limitation and use
targeted searches and source reads. Avoid automatic installs or upgrades.
If extraction fails, retain the previous graph as stale, continue with source
inspection, and report the failed refresh in the handoff. A failed refresh must
not be reported as current, and a successful graph refresh does not replace
application validation.
