# Mallary CLI

Mallary CLI is the official command-line interface for the https://mallary.ai social media scheduling/posting tool. It gives developers, operators, scripts, CI jobs, and AI agents a fast way to work with the same public platform that powers the Mallary.ai dashboard, REST API, and MCP server.

With the CLI you can:

- upload local media files to Mallary.ai
- create and schedule posts to your social media accounts
- inspect jobs and grouped posts
- list comments and reply to comments on published posts
- fetch post analytics and connected-account audience counts
- manage webhooks
- manage your brand settings
- list connected platforms
- disconnect platforms

Mallary CLI is a direct client for the public Mallary.ai API. It does not bypass plan limits, feature gates, or platform rules. Most CLI access is available on paid plans only.

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

OAuth is the default for interactive use, including OpenClaw, Hermes, and other AI agent harnesses. Start a browser-based login:

```bash
mallary auth login
mallary auth status
```

The CLI prints a Mallary sign-in URL and a one-time code. Open the URL, sign in to Mallary, check the requested access, and approve it. The agent never needs your Mallary password, API key, access token, or refresh token.

One OAuth login grants read, publish, engage, and manage access. Users do not choose scopes or sign in again when they use another Mallary feature. OAuth login does not publish or change anything by itself.

By default, the CLI stores OAuth credentials outside the current project in the operating system's per-user application configuration directory. On macOS and Linux, the credentials file is restricted to the current user. Access tokens refresh automatically. Remove and revoke the stored OAuth connection with `mallary auth logout`.

For an AI agent, a clear request to publish, schedule, upload media for that post, or send a reply authorizes that action. The agent should ask only when a material detail is missing or ambiguous, not request a second confirmation. Destructive or account-access actions should still identify their target and effect clearly.

### API key alternative

API-key authentication remains supported for CI and other environments where OAuth is not practical:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
```

When `MALLARY_API_KEY` is set, it takes precedence over stored OAuth credentials. `mallary auth status` reports the active method without printing any credential.

API-key safety:

- Treat `MALLARY_API_KEY` as a bearer secret that can authorize posting and account-management actions.
- Store it in a password manager, locked-down untracked env file, or masked CI secret. Never commit it.
- Do not paste real keys into prompts, tickets, screenshots, or shared terminals. This prevents shell-history exposure.
- Do not print the key with `echo`, `printenv`, debug logs, shell tracing, or CI output. Redact logs before you share them.
- If the key is exposed, rotate or revoke it.

Most CLI commands are available on paid plans only: Starter, Pro, and Business. Comment listing and supplied comment replies are available on all plans.

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
  --profile-id AbC123xYz90 \
  --media ./launch.mp4 \
  --thumbnail ./launch-cover.jpg
```

List your posts:

```bash
mallary posts list
```

List comments on a published post:

```bash
mallary comments list --post-id 123
```

Post a supplied reply:

```bash
mallary comments reply --post-id 123 --comment-id "1789..." --message "Thanks for checking this out."
```

Inspect one job:

```bash
mallary jobs get 123
```

Completed publishing jobs show `Post ID` and `Post URL` when the platform provides them. JSON output includes the same values as `platform_post_id` and `platform_post_url`.

List your connected platforms:

```bash
mallary platforms list
```

## Commands

### Health

```bash
mallary health
mallary health --json
```

### Upload

> Privacy warning: `mallary upload` transmits the selected local file contents to Mallary storage/CDN infrastructure, including third-party hosting/CDN providers. Do not pass local paths that contain sensitive, regulated, customer, or private data unless the user clearly requested that remote upload.

```bash
mallary upload ./image.png
mallary upload ./image.png ./video.mp4 --json
```

This command:

1. calls Mallary to create a presigned upload URL
2. uploads the local bytes for you
3. returns the final Mallary media URL

The same remote transfer happens when `mallary posts create` receives local media paths such as `--media ./launch.png`. The CLI uploads those files before it creates the post.

### Posts

Create from flags:

```bash
mallary posts create \
  --message "Hello from Mallary CLI" \
  --platform facebook \
  --platform linkedin \
  --media ./launch-video.mp4 \
  --thumbnail ./launch-cover.jpg \
  --comment "Follow-up comment 1" \
  --comment "Follow-up comment 2" \
  --auto-reply-enabled \
  --scheduled-at 2026-03-30T15:00:00Z
```

Create with a local wall-clock schedule plus timezone:

```bash
mallary posts create \
  --message "Timezone-aware launch" \
  --platform threads \
  --scheduled-at 2026-04-06T09:30 \
  --scheduled-timezone America/Los_Angeles
```

Create from a JSON file:

```bash
mallary posts create --file ./post.json
```

Example `post.json`:

```json
{
  "message": "Launch update",
  "platforms": ["youtube", "facebook"],
  "media": [{ "url": "./launch.mp4", "thumbnail_url": "./launch-cover.jpg" }],
  "platform_options": {
    "youtube": {
      "message": "YouTube description for the launch video",
      "title": "Launch update"
    },
    "facebook": {
      "message": "Facebook caption for this launch"
    }
  }
}
```

Notes:

- `--file` is for raw/advanced payloads and is mutually exclusive with payload-building flags.
- In flag mode, use `--scheduled-at` with an absolute timestamp like `2026-04-06T18:30:00Z`, or pair a local time like `2026-04-06T14:30` with `--scheduled-timezone America/New_York`.
- `--scheduled-timezone` requires `--scheduled-at`.
- In file mode, the CLI checks each `media[].url` value.
- If `media[].url` is a local file path like `./launch.png`, the CLI uploads that file to the Mallary CDN first, then replaces it with the final hosted Mallary CDN file URL before sending the post request.
- In file mode, local `media[].thumbnail_url` paths are also uploaded automatically.
- If `media[].url` is already a remote URL, it must already be hosted on `https://files.mallary.ai/...`. External media URLs are rejected by the CLI.
- Existing remote `media[].thumbnail_url` values must also already be hosted on `https://files.mallary.ai/...`.
- This is intentional because many social platforms only accept trusted media URLs. The CLI requires media to be uploaded to the Mallary CDN first.
- Platform-specific payloads are supported in file mode via `platform_options`.
- When a destination needs a platform-specific message or caption, use `platform_options.<platform>.message`.
- Each key in `platform_options` must match the platform name you put in `platforms`.

Video thumbnails:

- In flag mode, use `--thumbnail` with exactly one `--media` item.
- In file mode, put `thumbnail_url` on the video media item.
- YouTube regular videos, Facebook videos, and Instagram videos/Reels can use custom thumbnails/covers.
- YouTube accepts `jpg`, `jpeg`, or `png` thumbnails up to 2 MB. Recommended: `1280x720` 16:9. YouTube Shorts thumbnails are skipped.
- Facebook videos accept `jpg`, `jpeg`, or `png` thumbnails up to 10 MB.
- TikTok video posts do not accept arbitrary image thumbnails through Mallary. A `thumbnail_url` value disables Mallary's `video_cover_timestamp_ms` behavior. TikTok then uses its default cover.
- TikTok photo posts can use `thumbnail_url` for the cover photo. It works only when the URL exactly matches one of the supplied photo URLs.

Platform-specific payloads:

- These are available only in file mode with `mallary posts create --file payload.json`.
- The CLI does not validate platform-specific keys itself. It passes them through to the Mallary API.
- If you include `platform_options.instagram`, your `platforms` array must include `instagram`. The same rule applies to every platform.
- For the exact currently documented `platform_options` fields and examples by platform, see:
  `https://docs.mallary.ai/api-reference/endpoint/create#body-platform-options`

Platform-specific media rules:

- The CLI uses the same platform media validation as the Mallary API.
- YouTube requires exactly one video.
- Instagram supports `feed`, `story`, `reel`, and `carousel` via `platform_options.instagram.post_type`. Stories use one image or video. Reels use one video. Carousels use 2 to 10 mixed image/video items.
- LinkedIn currently supports text-only posts or one image attachment only.
- TikTok video posts require one video, and TikTok photo posts support up to 35 JPEG/WebP images.
- Pinterest requires exactly one image or GIF, or exactly one video, plus `boardId`.
- Reddit image posts require one image or GIF, and Reddit video upload is not supported by the current public API path.
- X allows up to 4 images, or 1 video, or 1 GIF.
- Full matrix:
  `https://docs.mallary.ai/api-reference/endpoint/create#platform-specific-media-rules`

Payload shape:

```json
{
  "message": "Launch update",
  "platforms": ["facebook", "youtube"],
  "scheduled_at": "2026-04-06T14:30",
  "scheduled_timezone": "America/New_York",
  "media": [{ "url": "./launch.mp4", "thumbnail_url": "./launch-cover.jpg" }],
  "platform_options": {
    "facebook": {
      "message": "Facebook-specific launch copy",
      "post_type": "feed"
    },
    "youtube": {
      "message": "YouTube-specific video description",
      "post_type": "shorts",
      "title": "Launch update",
      "visibility": "public"
    }
  }
}
```

Facebook:

- `message`: optional Facebook-specific message/caption
- `post_type`: `feed` or `story`
- `link`: optional link URL for link-style feed posts without media
- `pageId`: optional advanced override if you need to target a specific connected Facebook Page

```json
{
  "message": "Read the full announcement",
  "platforms": ["facebook"],
  "platform_options": {
    "facebook": {
      "message": "Facebook caption for this announcement",
      "post_type": "feed",
      "link": "https://example.com/blog/launch"
    }
  }
}
```

Instagram:

- `message`: optional Instagram-specific caption
- `post_type`: `feed`, `story`, `reel`, or `carousel`
- Stories do not support captions or follow-up comments. Include the story text in the media itself.
- Carousels support 2 to 10 image/video items.

```json
{
	  "message": "Behind the scenes",
	  "platforms": ["instagram"],
	  "media": [{ "url": "./reel.mp4", "thumbnail_url": "./reel-cover.jpg" }],
  "platform_options": {
    "instagram": {
      "message": "Instagram reel caption",
      "post_type": "reel"
    }
  }
}
```

LinkedIn:

- `message`: optional LinkedIn-specific message
- `author_urn`: optional advanced override for the LinkedIn author/org URN used when publishing

```json
{
  "message": "Company update from ACME co",
  "platforms": ["linkedin"],
  "media": [{ "url": "./update.png" }],
  "platform_options": {
    "linkedin": {
      "message": "LinkedIn-specific company update",
      "author_urn": "urn:li:organization:123456"
    }
  }
}
```

YouTube:

- `message`: optional YouTube-specific description/default-title source
- `post_type`: `regular` or `shorts`
- `title`: optional custom title
- `visibility`: `public`, `unlisted`, or `private`
- `categoryId`: optional YouTube category id
- `madeForKids`: optional boolean

```json
{
	  "message": "Watch our latest product walkthrough",
	  "platforms": ["youtube"],
	  "media": [{ "url": "./walkthrough.mp4", "thumbnail_url": "./walkthrough-cover.jpg" }],
  "platform_options": {
    "youtube": {
      "message": "YouTube-specific video description",
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

- `message`: optional TikTok-specific caption/title fallback
- `post_type`: `video` or `photo`
- `post_mode`: `DIRECT_POST` or `MEDIA_UPLOAD`
- `source`: `FILE_UPLOAD` or `PULL_FROM_URL` for video posts. Photo posts always use `PULL_FROM_URL`
- TikTok `PULL_FROM_URL` media must already be hosted on Mallary CDN at `https://files.mallary.ai/...`
- TikTok photo posts currently accept only `jpg`, `jpeg`, or `webp` images. TikTok rejects `png` files
- `privacy_level`: optional direct-post override, must match TikTok creator info
- `disable_comment`: optional for direct post
- `disable_duet`: optional for direct-post video
- `disable_stitch`: optional for direct-post video
- `video_cover_timestamp_ms`: optional direct-post video cover frame
- `thumbnail_url` on a TikTok video media item overrides Mallary's timestamp cover behavior. Mallary does not send arbitrary image thumbnails to TikTok video posts
- `title`: optional override. It defaults to `message`
- `description`: optional for photo posts
- `auto_add_music`: optional for direct-post photo
- `brand_content_toggle`, `brand_organic_toggle`: optional TikTok disclosure toggles
- `is_aigc`: optional direct-post video AI-content label
- `photo_cover_index`: optional photo cover selection
- `thumbnail_url` on a TikTok photo media item selects the cover. It works only when the URL exactly matches one of the supplied photo URLs

Defaults:

- Video posts default to `post_mode=MEDIA_UPLOAD` and `source=FILE_UPLOAD`.
- Photo posts default to `post_mode=MEDIA_UPLOAD`.
- If `privacy_level` is omitted for direct post, Mallary first tries the first allowed privacy level from TikTok creator info, preferring `PUBLIC_TO_EVERYONE`, then `MUTUAL_FOLLOW_FRIENDS`, then `FOLLOWER_OF_CREATOR`, then `SELF_ONLY`. If TikTok returns the private-account-only direct-post restriction, Mallary retries once with the most private allowed level.
- If `disable_comment`, `disable_duet`, or `disable_stitch` are omitted for direct post, Mallary falls back to the creator settings returned by TikTok.

```json
{
  "message": "New feature demo",
  "platforms": ["tiktok"],
  "media": [{ "url": "./demo.mp4" }],
  "platform_options": {
    "tiktok": {
      "post_type": "video",
      "post_mode": "DIRECT_POST",
      "source": "FILE_UPLOAD",
      "privacy_level": "FOLLOWER_OF_CREATOR",
      "disable_comment": false,
      "disable_duet": false,
      "disable_stitch": false,
      "video_cover_timestamp_ms": 1000,
      "brand_content_toggle": false,
      "brand_organic_toggle": false,
      "is_aigc": false
    }
  }
}
```

Photo post example:

```json
{
  "message": "Photo launch",
  "platforms": ["tiktok"],
  "media": [
    { "url": "https://files.mallary.ai/photo-1.webp" },
    { "url": "https://files.mallary.ai/photo-2.webp" }
  ],
  "platform_options": {
    "tiktok": {
      "post_type": "photo",
      "post_mode": "DIRECT_POST",
      "description": "Behind the scenes from launch day",
      "privacy_level": "PUBLIC_TO_EVERYONE",
      "disable_comment": false,
      "auto_add_music": true,
      "photo_cover_index": 1
    }
  }
}
```

Pinterest:

- `message`: optional Pinterest-specific description/default title source
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
      "message": "Pinterest-specific Pin description",
      "post_type": "image",
      "boardId": "920740542650170734",
      "link": "https://example.com/pricing",
      "alt_text": "Acme Co pricing page preview"
    }
  }
}
```

Reddit:

- `message`: optional Reddit-specific title/text source
- `post_type`: `text`, `link`, or `image`
- `subreddit` or `subredditName`: target subreddit name

```json
{
  "message": "We just launched a new agentic scheduling workflow",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "message": "Reddit-specific discussion prompt",
      "post_type": "text",
      "subreddit": "socialmedia"
    }
  }
}
```

X / Twitter:

- `message`: optional X-specific message, supplied as `platform_options.x.message` or `platform_options.twitter.message`.

Canonical reference for platform-specific post fields:

- `https://docs.mallary.ai/api-reference/endpoint/create#body-platform-options`

```json
{
  "message": "Shipping a new feature today",
  "platforms": ["x"],
  "media": [{ "url": "./launch.png" }],
  "platform_options": {
    "x": {
      "message": "X-specific launch copy"
    }
  }
}
```

Comments under post:

- Use repeatable `--comment` flags in flag mode.
- In file mode, send `comments_under_post` as an array.
- The API currently limits `comments_under_post` to 3 items.
- TikTok does not currently support `comments_under_post`.

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

- AI Auto Replies detect new comments on your published posts. They use OpenAI (ChatGPT) to post replies. The replies follow the settings that you configure in the Mallary dashboard, or the settings section below. Mallary supports AI Auto Replies on YouTube, Facebook, Instagram, LinkedIn, X (Twitter), and Reddit.
- Privacy warning: do not enable AI Auto Replies for posts or accounts where comments can contain sensitive, regulated, confidential, or customer-private data. Enable them only when you intend and approve that processing. When you enable AI Auto Replies, Mallary processes comment text, post context, connected-platform metadata, and saved brand/profile settings. Mallary also sends relevant context to OpenAI for reply generation.
- AI Auto Replies are available on Pro and Business plans only.
- AI Auto Replies depend on your saved brand/profile settings, not only on the current post payload.
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
mallary posts list --profile-id AbC123xYz90
mallary posts list --page 2 --per-page 25 --json
```

After Mallary publishes a post, grouped post results include per-platform post IDs and public post URLs. This applies only when the provider makes them available.

Delete a queued or scheduled post:

Warning: this is destructive. It permanently removes a queued or scheduled Mallary post/job that has not started publishing. Confirm the exact post ID, profile, schedule, and intended cancellation before deleting. This command does not remove already-published content from external social platforms.

```bash
mallary posts delete 123
```

### Comments

```bash
mallary comments list --post-id 123
mallary comments list --post-id 123 --platform instagram --limit 50 --json
mallary comments reply --post-id 123 --comment-id "1789..." --message "Thanks for checking this out."
```

The `comments` commands are designed to allow AI agents and automation to write and post replies to the comments on your social media posts. Mallary lists comments from your published posts, and the `comments reply` command posts the exact reply text that you provide.

### Jobs

```bash
mallary jobs get 123
mallary jobs get 123 --json
```

Completed jobs include `platform_post_id` and `platform_post_url` in JSON mode, and print `Post ID` / `Post URL` in normal output when available.

### Analytics

```bash
mallary analytics list
mallary analytics list --profile-id AbC123xYz90
mallary analytics list --post-id 123
```

### Audience

Get the latest follower or subscriber count for every connected account in a profile:

```bash
mallary audience list
mallary audience list --profile-id AbC123xYz90
mallary audience list --json
```

Mallary updates supported audience counts once every 24 hours. TikTok and LinkedIn show `permission_required` until Mallary adds the permissions those platforms need.

### Profiles

Use profiles to group your social media accounts. You can create a profile for each of your businesses. Then connect the social media accounts for each business inside this profile. If you do not pass a `profile_id` in a request, Mallary uses your default profile.

List connection profiles and copy the public profile ID for non-default profile commands:

Privacy warning: profile lists and connected-platform state can reveal internal account structure, account labels, and operational configuration. Request only the specific profile ID needed, and redact profile IDs, profile names, account labels, and connected-platform details before sharing logs, screenshots, or agent transcripts.

```bash
mallary profiles list
mallary profiles list --json
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

Privacy warning: settings output can include brand context, contact information, pricing, FAQ content, and AI auto-reply configuration. Retrieve only what you need, avoid broad dumps, and redact sensitive values before sharing logs, screenshots, tickets, or agent transcripts.

```bash
mallary settings get
mallary settings get --profile-id AbC123xYz90
```

Update settings from a partial JSON file:

```bash
mallary settings update --file ./settings.partial.json
mallary settings update --file ./settings.partial.json --profile-id AbC123xYz90
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
- Settings are profile-scoped. Omit `--profile-id` to use your default profile.
- `auto_reply_enabled` can only be turned on for paid plans that include AI auto reply.
- Enabling `auto_reply_enabled` also requires these settings fields to be populated: `business_name`, `website_url`, `business_description`, `services`, and `contact_info`.

### Platforms

List your connected platforms against Mallary's full supported platform set:

```bash
mallary platforms list
mallary platforms list --profile-id AbC123xYz90
```

Disconnect a platform:

Warning: disconnecting a platform is destructive/account-impacting. It removes Mallary's ability to post, reply, and fetch analytics for that connected account until it is reconnected. Confirm the platform and profile before running.

```bash
mallary platforms disconnect facebook
mallary platforms disconnect facebook --profile-id AbC123xYz90
```

Use Mallary profiles to group your social media accounts. You can create a profile for each of your businesses. Then connect the social media accounts for each business inside this profile. If you do not pass a `profile_id` in a request, Mallary uses your default profile.


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

> Warning: automation examples can upload local media and publish real posts to connected social-media accounts. Run them only in a workflow whose target profile, platforms, message/media, and timing are clearly defined.

Keep `MALLARY_API_KEY` in masked CI secrets and pass it through `env`. Do not enable `set -x` or otherwise print request headers, environment variables, or command output that can leak the key.

Example shell script:

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${MALLARY_API_KEY:?missing}"

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
- use `--json` whenever the CLI is part of an automated toolchain
- prefer `mallary posts create --file payload.json` for complex platform-specific payloads
- for engagement, call `mallary comments list`, write the reply in the user's voice, then call `mallary comments reply`

## Links

- Main site: https://mallary.ai/
- Dashboard: https://mallary.ai/dashboard
- Pricing: https://mallary.ai/pricing
- API docs: https://docs.mallary.ai/
- MCP docs source: `docs/mcp.md`
- Support: mailto:support@mallary.ai

## Versioning

Mallary CLI uses semantic versioning.
