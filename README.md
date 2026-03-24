# Mallary CLI

Mallary CLI is the official command-line interface for Mallary. It gives developers, operators, scripts, CI jobs, and AI agents a fast way to work with the same public Mallary platform that powers the dashboard, REST API, and MCP server.

With the CLI you can:
- upload local media files to Mallary
- create and schedule posts
- inspect jobs and grouped posts
- fetch analytics
- manage webhooks
- manage brand settings
- disconnect platforms

Mallary CLI is a direct client for the public Mallary API. It does not bypass plan limits, feature gates, or platform rules.

## Install

### npm

```bash
npm install -g @mallary/cli
```

### npx

```bash
npx @mallary/cli --help
```

### Update

```bash
npm install -g @mallary/cli@latest
```

### Uninstall

```bash
npm uninstall -g @mallary/cli
```

## Authentication

Mallary CLI uses environment-variable auth only.

```bash
export MALLARY_API_KEY="your_mallary_api_key"
```

Optional:

```bash
export MALLARY_BASE_URL="https://mallary.ai"
```

Use `MALLARY_BASE_URL` for staging or local API targets when needed.

## Quickstart

Check health:

```bash
mallary health
```

Upload a local file:

```bash
mallary upload ./launch.mp4
```

Create a post from flags:

```bash
mallary posts create \
  --message "Mallary CLI is live." \
  --platform facebook \
  --platform instagram \
  --media ./launch.mp4
```

List posts:

```bash
mallary posts list
```

Inspect one job:

```bash
mallary jobs get 123
```

## Commands

### Health

```bash
mallary health
mallary health --json
```

Checks `GET /health`.

### Upload

```bash
mallary upload ./image.png
mallary upload ./image.png ./video.mp4 --json
```

This command:
1. calls Mallary to create a presigned upload URL
2. uploads the local bytes for you
3. returns the final Mallary media URL

### Posts

Create from flags:

```bash
mallary posts create \
  --message "Hello from Mallary CLI" \
  --platform facebook \
  --platform linkedin \
  --media ./hero.png \
  --comment "Follow-up comment 1" \
  --scheduled-at 2026-03-30T15:00:00Z
```

Create from a JSON file:

```bash
mallary posts create --file ./post.json
```

Example `post.json`:

```json
{
  "message": "Launch update",
  "platforms": ["facebook", "instagram", "linkedin"],
  "media": [
    { "url": "./launch.png" }
  ],
  "platform_options": {
    "youtube": {
      "title": "Launch update",
      "visibility": "public"
    }
  }
}
```

Notes:
- `--file` is for raw/advanced payloads and is mutually exclusive with payload-building flags.
- Local media paths are uploaded automatically even in file mode when they appear in `media[].url`.
- Remote media URLs are passed through unchanged.

List grouped posts:

```bash
mallary posts list
mallary posts list --page 2 --per-page 25 --json
```

Delete a queued or scheduled post:

```bash
mallary posts delete 123
```

### Jobs

```bash
mallary jobs get 123
mallary jobs get 123 --json
```

### Analytics

```bash
mallary analytics list
mallary analytics list --post-id 123
```

### Webhooks

List:

```bash
mallary webhooks list
```

Create:

```bash
mallary webhooks create \
  --url https://example.com/mallary \
  --event post.published \
  --event post.failed
```

Delete:

```bash
mallary webhooks delete 12
```

### Settings

Get current settings:

```bash
mallary settings get
```

Update settings from a partial JSON file:

```bash
mallary settings update --file ./settings.partial.json
```

Example partial settings payload:

```json
{
  "business_name": "Mallary",
  "business_description": "Agentic social publishing and analytics",
  "website_url": "https://mallary.ai"
}
```

### Platforms

Disconnect a platform:

```bash
mallary platforms disconnect facebook
```

## JSON Output

Human-readable output is the default.

Use `--json` for scripting:

```bash
mallary posts list --json
```

Output rules:
- direct API wrapper commands emit the API response body
- convenience flows like `upload` emit CLI-specific JSON
- `posts create` emits CLI-specific JSON when local file uploads occur before submission

Example:

```bash
mallary upload ./launch.png --json
```

```json
{
  "ok": true,
  "uploads": [
    {
      "source_path": "./launch.png",
      "filename": "launch.png",
      "media_url": "https://files.mallary.ai/uploads/launch.png",
      "storage_key": "uploads/launch.png",
      "content_type": "image/png",
      "size": 18293
    }
  ]
}
```

## Exit Codes

- `0`: success
- `1`: local CLI/config/input failure
- `2`: remote API or upload failure

## Automation and CI

Example shell script:

```bash
#!/usr/bin/env bash
set -euo pipefail

export MALLARY_API_KEY="${MALLARY_API_KEY:?missing}"

UPLOAD_JSON="$(mallary upload ./hero.png --json)"
MEDIA_URL="$(printf '%s' "$UPLOAD_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).uploads[0].media_url))')"

mallary posts create \
  --message "Deployed via CI" \
  --platform facebook \
  --platform linkedin \
  --media "$MEDIA_URL" \
  --json
```

GitHub Actions example:

```yaml
- name: Install Mallary CLI
  run: npm install -g @mallary/cli

- name: Publish post
  env:
    MALLARY_API_KEY: ${{ secrets.MALLARY_API_KEY }}
  run: |
    mallary posts create \
      --message "Release shipped." \
      --platform facebook \
      --platform linkedin
```

## AI Agent Notes

If you are an AI agent or building an agent integration:
- read `llms.txt` first for the compact command and workflow summary
- read `AGENTS.md` for repo/build/release instructions if you are modifying the CLI codebase
- use `--json` whenever the CLI is part of an automated toolchain
- prefer `mallary posts create --file payload.json` for complex platform-specific payloads

## Links

- Main site: https://mallary.ai/
- Dashboard: https://mallary.ai/dashboard
- Pricing: https://mallary.ai/pricing
- API docs: https://docs.mallary.ai/
- MCP docs source: `docs/mcp.md`
- Support: mailto:support@mallary.ai

## Versioning

Mallary CLI uses semantic versioning. See `RELEASING.md` and `CHANGELOG.md`.
