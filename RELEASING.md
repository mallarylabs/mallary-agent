# Releasing Mallary CLI

## Versioning

Mallary CLI uses semantic versioning.

- Patch: bug fixes, doc fixes, non-breaking UX polish
- Minor: new commands, new flags, new documented JSON fields, additive behavior
- Major: breaking command changes, breaking JSON output changes, renamed commands, removed flags

## Release checklist

1. Update code and docs in `cli/`
2. Run:
   - `npm install`
   - `npm test`
   - `npm run build`
3. Update `CHANGELOG.md`
4. Bump `package.json` version
5. Confirm `README.md`, `llms.txt`, and `AGENTS.md` still match live behavior
6. Publish from the standalone CLI repo or mirrored package directory

## Release note template

Use this format:

```md
## Mallary CLI x.y.z

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Notes
- ...
```

## Mirror / split process

This package is developed in `cli/` inside the main Mallary repo, but it is intentionally structured to mirror into its own GitHub repo.

Recommended process:

1. Treat `cli/` as the standalone repo root
2. Copy or sync the full contents of `cli/` into the CLI repo
3. Preserve package-local docs and tests
4. Run `npm install`, `npm test`, and `npm run build` in the standalone repo
5. Publish the package from that standalone repo

## Publishing notes

- Package name: `@mallary/cli`
- Binary name: `mallary`
- Target Node version: `>=18`
- Keep `files` in `package.json` tight so the published package only contains runtime output and essential docs
