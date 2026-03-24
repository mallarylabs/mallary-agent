CLI Repo Notes for Future Agents
================================

Overview
- This package is the public Mallary CLI.
- It is developed in `cli/` inside the main Mallary repo, but it must stay self-contained so it can be mirrored into its own GitHub repo without code surgery.
- The CLI is a direct REST client to the public Mallary API. It is not an MCP client and it must not depend on PHP/dashboard code.

Package boundaries
- Keep runtime code inside `src/`.
- Do not import from `public/` or `node-service/`.
- Avoid coupling to internal-only API routes or dashboard-only behavior.
- If Mallary API contracts change, update the CLI based on public API behavior and docs, not private assumptions.

Auth and transport
- Auth is env-only: `MALLARY_API_KEY`.
- Optional environment override: `MALLARY_BASE_URL`.
- Default production base URL is `https://mallary.ai`.
- All authenticated requests should identify as CLI via headers.

Output contract
- Human-readable output is the default.
- `--json` is the stable automation mode.
- For direct API wrapper commands, `--json` should emit the API response body.
- For CLI convenience flows like end-to-end uploads, `--json` may emit CLI-shaped payloads, but keep them documented in `README.md` and `llms.txt`.
- Do not print non-JSON noise to stdout in `--json` mode.

Build and test
- Install: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Entry point: `src/index.ts`

Release expectations
- Versioning is semver.
- Update `CHANGELOG.md` for every release.
- Keep docs publish-ready: `README.md`, `llms.txt`, `AGENTS.md`, `RELEASING.md`.
- The package should remain mirrorable into a standalone repo with minimal or no path rewrites.

Mirror/split intent
- Treat `cli/` as the future standalone repo root.
- Any new config, docs, or scripts required to publish the CLI should live inside `cli/`.
- Avoid references that only make sense from the monorepo root unless absolutely necessary.
