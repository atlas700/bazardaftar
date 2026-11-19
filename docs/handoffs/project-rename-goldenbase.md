# GoldenBase project rename

**Completed 19 November 2026.** The founder renamed BazarDaftar to GoldenBase.

## Changes

- Renamed the GitHub repository from `atlas700/bazardaftar` to
  `atlas700/goldenbase`; GitHub redirects the old repository URL.
- Updated the repository description, README, contributor instructions, app
  branding, metadata, and the npm package name and lockfile entry to GoldenBase.
- Updated owned E2E fixture labels and temporary backup/restore directory names.
- Updated active repository links and the Netlify import instructions.

## Compatibility retained

The Clerk request ID header and browser theme storage key retain their old
identifiers so existing integrations and saved theme preferences continue to
work. Historical handoffs keep the project name and provider resource names that
were true when recorded. The existing staging site remains at
`https://bazardaftar.netlify.app`; changing a deployed domain requires a separate
Netlify configuration and DNS change.

## Verification and limits

The GitHub repository name, description, local remote, and checkout folder
`goldenbase` were checked after the rename. Application and integration tests
were not run.
