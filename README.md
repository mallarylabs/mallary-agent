# Mallary CLI

Mallary CLI is the official command-line interface for the Mallary.ai social media scheduling/posting tool. It gives developers, operators, scripts, CI jobs, and AI agents a fast way to work with the same public platform that powers the Mallary.ai dashboard, REST API, and MCP server.

With the CLI you can:

- upload local media files to Mallary.ai
- create and schedule posts to your social media accounts
- inspect jobs and grouped posts
- fetch post analytics
- manage webhooks
- manage your brand settings
- disconnect platforms

Mallary CLI is a direct client for the public Mallary.ai API. It does not bypass plan limits, feature gates, or platform rules.

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

Mallary CLI uses environment-variable auth only. Get your API key at https://mallary.ai now.

```bash
export MALLARY_API_KEY="your_mallary_api_key"
```

## Quickstart

Check the health of Mallary.ai services:

```bash
mallary health
```

Upload a local file to Mallary.ai CDN:

```bash
mallary upload ./launch.mp4
```

Create a social media post from flags:

```bash
mallary posts create \
  --message "Check out my new product video!" \
  --platform facebook \
  --platform instagram \
  --media ./launch.mp4
```

List your posts:

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
  --comment "Follow-up comment 2" \
  --auto-reply-enabled \
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
  "media": [{ "url": "./launch.png" }],
  "platform_options": {
    "instagram": {
      "post_type": "carousel"
    }
  }
}
```

Notes:

- `--file` is for raw/advanced payloads and is mutually exclusive with payload-building flags.
- In file mode, the CLI checks each `media[].url` value.
- If `media[].url` is a local file path like `./launch.png`, the CLI uploads that file to the Mallary CDN first, then replaces it with the final hosted Mallary CDN file URL before sending the post request.
- If `media[].url` is already a remote URL, it must already be hosted on `https://files.mallary.ai/...`. External media URLs are rejected by the CLI.
- This is intentional because many social platforms only accept trusted media URLs. The CLI requires media to be uploaded to the Mallary CDN first.
- Platform-specific payloads are supported in file mode via `platform_options`.
- Each key in `platform_options` should match the platform name you put in `platforms`.

Platform-specific payloads:

- These are available only in file mode with `mallary posts create --file payload.json`.
- The CLI does not validate platform-specific keys itself; it passes them through to the Mallary API.
- If you include `platform_options.instagram`, your `platforms` array should include `instagram`. The same rule applies to every platform.

Payload shape:

```json
{
  "message": "Launch update",
  "platforms": ["facebook", "youtube"],
  "media": [{ "url": "./launch.mp4" }],
  "platform_options": {
    "facebook": {
      "post_type": "feed"
    },
    "youtube": {
      "post_type": "shorts",
      "title": "Launch update",
      "visibility": "public"
    }
  }
}
```

Facebook:

- `post_type`: `feed` or `story`
- `link`: optional link URL for link-style feed posts without media
- `pageId`: optional advanced override if you need to target a specific connected Facebook Page

```json
{
  "message": "Read the full announcement",
  "platforms": ["facebook"],
  "platform_options": {
    "facebook": {
      "post_type": "feed",
      "link": "https://example.com/blog/launch"
    }
  }
}
```

Instagram:

- `post_type`: `feed`, `story`, `reel`, or `carousel`

```json
{
  "message": "Behind the scenes",
  "platforms": ["instagram"],
  "media": [{ "url": "./reel.mp4" }],
  "platform_options": {
    "instagram": {
      "post_type": "reel"
    }
  }
}
```

LinkedIn:

- `author_urn`: optional advanced override for the LinkedIn author/org URN used when publishing

```json
{
  "message": "Company update from ACME co",
  "platforms": ["linkedin"],
  "media": [{ "url": "./update.png" }],
  "platform_options": {
    "linkedin": {
      "author_urn": "urn:li:organization:123456"
    }
  }
}
```

YouTube:

- `post_type`: `regular` or `shorts`
- `title`: optional custom title
- `visibility`: `public`, `unlisted`, or `private`
- `categoryId`: optional YouTube category id
- `madeForKids`: optional boolean

```json
{
  "message": "Watch our latest product walkthrough",
  "platforms": ["youtube"],
  "media": [{ "url": "./walkthrough.mp4" }],
  "platform_options": {
    "youtube": {
      "post_type": "shorts",
      "title": "Acme Co walkthrough",
      "visibility": "unlisted",
      "categoryId": "28",
      "madeForKids": false
    }
  }
}
```

TikTok:

- No additional platform-specific payload fields are currently consumed by the public API beyond the standard post body.
- TikTok behavior is driven by the connected account and the uploaded media.

```json
{
  "message": "New feature demo",
  "platforms": ["tiktok"],
  "media": [{ "url": "./demo.mp4" }]
}
```

Pinterest:

- `post_type`: `image` or `video`
- `boardId`: board id to publish into
- `link`: optional destination URL
- `alt_text`: optional alt text for the Pin image

```json
{
  "message": "Product launch",
  "platforms": ["pinterest"],
  "media": [{ "url": "./launch.png" }],
  "platform_options": {
    "pinterest": {
      "post_type": "image",
      "boardId": "920740542650170734",
      "link": "https://example.com/pricing",
      "alt_text": "Acme Co pricing page preview"
    }
  }
}
```

Reddit:

- `post_type`: `text`, `link`, or `image`
- `subreddit` or `subredditName`: target subreddit name

```json
{
  "message": "We just launched a new agentic scheduling workflow",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "post_type": "text",
      "subreddit": "socialmedia"
    }
  }
}
```

Google Business:

- `accountId`: Google Business account id
- `locationId`: Google Business location id
- `languageCode`: optional language code, defaults to `en-US`
- `link`: optional call-to-action URL

```json
{
  "message": "We are now taking spring bookings",
  "platforms": ["google_business"],
  "media": [{ "url": "./storefront.jpg" }],
  "platform_options": {
    "google_business": {
      "accountId": "1234567890",
      "locationId": "9876543210",
      "languageCode": "en-US",
      "link": "https://example.com/book"
    }
  }
}
```

Snapchat:

- `contentType` or `post_type`: `story`, `saved_story`, or `spotlight`
- Snapchat posting also requires Snapchat partner/API access to be enabled for your Mallary deployment

```json
{
  "message": "Behind the scenes",
  "platforms": ["snapchat"],
  "media": [{ "url": "./story.mp4" }],
  "platform_options": {
    "snapchat": {
      "contentType": "spotlight"
    }
  }
}
```

X / Twitter:

- No additional platform-specific payload fields are currently consumed by the public API beyond the standard post body.

```json
{
  "message": "Shipping a new feature today",
  "platforms": ["x"],
  "media": [{ "url": "./launch.png" }]
}
```

Comments under post:

- Use repeatable `--comment` flags in flag mode.
- In file mode, send `comments_under_post` as an array.
- The API currently limits `comments_under_post` to 3 items.

Example:

```bash
mallary posts create \
  --message "New launch today" \
  --platform facebook \
  --media ./launch.png \
  --comment "What do you think?" \
  --comment "Questions? Ask below."
```

File mode example:

```json
{
  "message": "New launch today",
  "platforms": ["facebook"],
  "media": [{ "url": "./launch.png" }],
  "comments_under_post": [
    { "content": "What do you think?" },
    { "content": "Questions? Ask below." }
  ]
}
```

AI auto reply:

- AI Auto Replies automatically detect new comments on your published posts and uses OpenAI (ChatGPT) to post helpful replies based on your settings in configured the Mallary dashboard or as described in the settings section below. AI Auto Replies are supported on YouTube, Facebook, Instagram, LinkedIn, X (Twitter), Reddit.
- AI Auto Replies are available on Pro and Business plans only.
- It depends on your saved brand/profile settings, not just the current post payload.
- You can enable it account-wide in `mallary settings update`, or per post with `--auto-reply-enabled`.
- If you omit `--auto-reply-enabled`, the post uses your saved account-level setting.
- To enable it successfully, your settings must include: `business_name`, `website_url`, `business_description`, `services`, and `contact_info`.

Per-post example:

```bash
mallary posts create \
  --message "Ask us anything about agentic scheduling." \
  --platform facebook \
  --media ./hero.png \
  --auto-reply-enabled
```

File mode example:

```json
{
  "message": "Ask us anything about agentic scheduling.",
  "platforms": ["facebook"],
  "media": [{ "url": "./hero.png" }],
  "auto_reply_enabled": true
}
```

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
  "auto_reply_enabled": true,
  "brand_profile": "Mallary helps brands schedule, publish, and manage social media content with AI-assisted workflows.",
  "business_name": "My Business",
  "business_description": "Local HVAC company",
  "website_url": "https://example.com",
  "services": "HVAC installation, repair, and maintenance",
  "features": "Same-day service, financing, weekend appointments",
  "contact_info": "Call (555) 555-5555 or email hello@example.com",
  "pricing": "Free estimates. Maintenance plans start at $29/month.",
  "faq": "Q: Do you offer emergency service? A: Yes, 24/7."
}
```

Accepted settings fields:

- `auto_reply_enabled`
- `brand_profile`
- `business_name`
- `business_description`
- `website_url`
- `services`
- `features`
- `contact_info`
- `pricing`
- `faq`

Notes:

- `mallary settings update --file ...` accepts partial updates, so you can send only the fields you want to change.
- `auto_reply_enabled` can only be turned on for paid plans that include AI auto reply.
- Enabling `auto_reply_enabled` also requires these settings fields to be populated: `business_name`, `website_url`, `business_description`, `services`, and `contact_info`.

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
