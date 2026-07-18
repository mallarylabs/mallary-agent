---
name: mallary
description: Use this skill only when the user explicitly asks to use Mallary, Mallary CLI, Mallary API, or Mallary MCP, or asks to manage an existing Mallary workflow. It covers Mallary-specific publishing, scheduling, uploads, comments, analytics, webhooks, settings, and platform connections. Prefer read-only Mallary discovery first; do not suggest or run posting, uploads, replies, deletes, webhook changes, settings updates, or platform disconnects without explicit user intent and confirmation.
version: 1.0.2
homepage: https://mallary.ai/
metadata:
  openclaw:
    emoji: "🌎"
    requires:
      bins: []
      env:
        - MALLARY_API_KEY
---

## Install Mallary if it doesn't exist

```bash
npm install -g @mallary/cli
# or
npx @mallary/cli --help
```

npm release: https://www.npmjs.com/package/@mallary/cli
mallary github: https://github.com/mallarylabs/mallary-agent
mallary cli github: https://github.com/mallarylabs/mallary-agent
official website: https://mallary.ai

---

| Property          | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **name**          | mallary                                                               |
| **description**   | Social media publishing CLI for multi-platform posting and automation |
| **allowed-tools** | Bash(mallary\*)                                                       |

---

## ⚠️ Authentication Required

**You MUST set `MALLARY_API_KEY` before running Mallary's authenticated CLI commands.** The only routine command that does not require auth is `mallary health`.

Before doing anything else, confirm the environment variable is set without printing the key:

```bash
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"
```

If it is not set:

1. **API Key:** set `MALLARY_API_KEY` from a secret manager or masked CI secret. For an interactive bash/zsh session, use `read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY` so the key is not printed.

**Do NOT proceed with post, upload, analytics, webhook, settings, or platform commands until the API key is set.**

Credential safety: never print `MALLARY_API_KEY` with `echo`, `printenv`, debug logs, shell tracing, or CI output. Do not paste real keys into prompts, tickets, screenshots, or shell history. If a key is exposed, rotate or revoke it before continuing.

Most Mallary CLI commands are available on paid plans only: Starter, Pro, and Business. `mallary comments list` and `mallary comments reply` are available on all plans.

---

## ⚠️ Publishing Side Effects

`mallary posts create` is not a dry-run command. It publishes immediately to the connected social-media account, or schedules a real future publish when `--scheduled-at` is supplied.

Agents and automations must not run `mallary posts create` as a harmless smoke test. Before invoking it, explicitly confirm the target profile, target platform(s), message/media, and whether the user intends to create a real public or scheduled social-media post. For lower-impact tests, use read-only commands such as `mallary health`, `mallary profiles list`, `mallary platforms list`, or `mallary posts list`, and redact any profile, platform, or account metadata before sharing output.

---

## ⚠️ Command Side Effects

Treat Mallary CLI commands by side-effect level:

- **Read-only but potentially sensitive:** `mallary profiles list`, `mallary platforms list`, `mallary posts list`, `mallary jobs get`, `mallary analytics list`, `mallary settings get`, and `mallary webhooks list` do not mutate state, but their output can expose operational metadata. Minimize, filter, and redact before sharing. `mallary health` is the lowest-risk smoke test.
- **Data-transmitting:** `mallary upload <file...>` sends local file contents to Mallary storage/CDN infrastructure, including third-party hosting/CDN providers; confirm file paths and contents before running it, and do not upload sensitive, regulated, customer, or private files unless that remote transfer is intended and approved.
- **Publishing or engagement:** `mallary posts create` and `mallary comments reply` create externally visible content or replies; confirm target profile, platform/post/comment IDs, and final text/media before running them.
- **Destructive/account-impacting:** `mallary posts delete`, `mallary webhooks create`, `mallary webhooks delete`, `mallary settings update`, and `mallary platforms disconnect` change account state, delivery configuration, brand/auto-reply behavior, or platform connectivity. Confirm the exact profile, IDs, URL, JSON fields, and intended outcome before running them.

When operating as an AI agent, prefer minimized read-only discovery first, treat discovery output as potentially sensitive, redact metadata before sharing, and ask for explicit user approval before any data-transmitting, publishing, destructive, or account-impacting command.

---

## Core Workflow

The fundamental pattern for using Mallary CLI:

1. **Authenticate** - Set `MALLARY_API_KEY`
2. **Select profile** - Use the default profile or pass `--profile-id` for a non-default Dashboard profile
3. **Prepare** - Upload local media files if needed
4. **Post** - Create immediate or scheduled posts with shared fields or file-mode payloads
5. **Inspect** - Check grouped posts and job status
6. **Engage** - List comments, write replies in the user's voice, and reply to comments
7. **Analyze** - Fetch analytics and review action-required outcomes

````bash
# 1. Authenticate without printing or logging the real key
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY

# 2. Prepare
mallary profiles list
mallary upload image.jpg

# 3. Post
mallary posts create --message "Content" --platform facebook --media ./image.jpg

# 4. Inspect
mallary posts list
mallary jobs get 123

# 5. Engage
mallary comments list --post-id 123 --json
mallary comments reply --post-id 123 --comment-id "1789..." --message "Thanks for checking this out."

# 6. Analyze
mallary analytics list --post-id 42


---

## Essential Commands

### Authentication

Mallary CLI uses environment-variable auth only:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
````

Check API health without auth:

```bash
mallary health
mallary health --json
```

There is no OAuth login command and no custom API URL override in the public CLI.

### Integration Discovery

Mallary exposes a lightweight connected-platform discovery command in the CLI.

Read-only discovery can still expose sensitive operational metadata. Profile IDs, profile names, connected-platform state, and settings can reveal internal account structure, brand configuration, and AI auto-reply behavior. Agents should request only the minimum needed fields, avoid broad dumps, and redact profile IDs, account labels, platform connection details, and settings values before sharing logs, transcripts, or summaries.

Instead, use:

```bash
# List dashboard profiles only when needed; do not broadly expose profile IDs
mallary profiles list

# List connected-platform state only for the target profile; redact before sharing
mallary platforms list
mallary platforms list --profile-id AbC123xYz90

# Build advanced posts from a JSON payload
mallary posts create --file post.json
```

You can also inspect saved profile-scoped settings:

Treat settings output as sensitive configuration. Use `--json` plus local filtering when possible, share only the specific field needed, and redact brand context, contact information, pricing, FAQ, auto-reply settings, and profile IDs from agent transcripts or tickets.

```bash
mallary settings get
mallary settings get --profile-id AbC123xYz90
```

For platform-specific fields, use:

- `platform_options` in file mode
- `platform_options.<platform>.message` for platform-specific messages or captions
- `cli/PROVIDER_SETTINGS.md`
- `https://docs.mallary.ai/api-reference/endpoint/create#body-platform-options`
- `https://docs.mallary.ai/api-reference/endpoint/create#platform-specific-media-rules`

### Connection Profiles

Profiles group platform connections, posts, analytics, and brand or AI auto-reply settings. The dashboard has one top-level **Dashboard profile** bar; everything underneath it belongs to the selected profile.

Rules:

- omit `--profile-id` or `profile_id` to use the default profile
- use `mallary profiles list` to find random public profile IDs such as `AbC123xYz90`
- use the public profile ID, not an internal numeric database ID
- treat profile IDs, profile names, connected-platform state, and profile-scoped settings as sensitive operational metadata; minimize and redact them before sharing
- connect accounts in the dashboard after selecting the intended Dashboard profile
- settings and AI auto-reply context are profile-scoped
- create and rename profile workflows are handled in the dashboard or REST API; the CLI currently lists and targets profiles

Profile-aware CLI commands:

```bash
mallary profiles list
mallary posts create --message "Launch update" --platform linkedin --profile-id AbC123xYz90
mallary posts list --profile-id AbC123xYz90
mallary analytics list --profile-id AbC123xYz90
mallary settings get --profile-id AbC123xYz90
mallary settings update --file settings.partial.json --profile-id AbC123xYz90
mallary platforms list --profile-id AbC123xYz90
mallary platforms disconnect facebook --profile-id AbC123xYz90
```

In file mode:

```json
{
  "profile_id": "AbC123xYz90",
  "message": "Launch update",
  "platforms": ["facebook", "linkedin"]
}
```

See [PROFILES.md](./PROFILES.md) for the full profile model, API endpoints, and plan limits.

### Creating Posts

```bash
# Simple immediate post
mallary posts create --message "Content" --platform facebook

# Simple immediate post from a non-default profile
mallary posts create --message "Content" --platform facebook --profile-id AbC123xYz90

# Scheduled post
mallary posts create --message "Content" --platform facebook --scheduled-at "2026-12-31T12:00:00Z"

# Scheduled post using local wall-clock time plus timezone
mallary posts create --message "Content" --platform facebook --scheduled-at "2026-12-31T09:00" --scheduled-timezone "America/New_York"

# Post with media
mallary posts create --message "Content" --media ./img1.jpg --platform instagram

# Post with a video thumbnail
mallary posts create --message "Content" --media ./video.mp4 --thumbnail ./cover.jpg --platform youtube

# Post with follow-up comments
mallary posts create \
  --message "Main post" \
  --media ./main.jpg \
  --comment "First comment" \
  --comment "Second comment" \
  --platform facebook

# Multi-platform post
mallary posts create --message "Content" --platform x --platform linkedin --platform facebook

# Platform-specific settings from a JSON file
mallary posts create --file post.json

# Complex post from JSON file with JSON output
mallary posts create --file post.json --json
```

### Managing Posts

Commands in this section include destructive and account-impacting actions. `posts list`, `jobs get`, and `platforms list` are read-only. `posts delete` permanently removes queued/scheduled Mallary posts that have not started publishing, and `platforms disconnect` removes Mallary's platform access until the user reconnects. Confirm IDs, profile, platform, and intended outcome before running state-changing commands.

```bash
# List grouped posts
mallary posts list
mallary posts list --profile-id AbC123xYz90
mallary posts list --page 2 --per-page 25

# Destructive: delete queued/scheduled Mallary post/job
mallary posts delete 123

# Get job status
mallary jobs get 123

# List connected platforms
mallary platforms list
mallary platforms list --profile-id AbC123xYz90

# Destructive/account-impacting: disconnect a platform
mallary platforms disconnect facebook
mallary platforms disconnect facebook --profile-id AbC123xYz90
```

### Analytics

```bash
# Get analytics across posts
mallary analytics list
mallary analytics list --profile-id AbC123xYz90

# Get analytics for a specific post
mallary analytics list --post-id 42
```

Returns analytics snapshots from the Mallary API for the selected profile or a specific post when available.

### Connecting Missing Posts

Mallary has a TikTok final-action flow if you want to get analytics for a TikTok post that was uploaded but not published (this is the default):

```bash
# 1. Inspect the job
mallary jobs get 506

# 2. If TikTok needs the final published URL after inbox/review completion
mallary jobs attach-tiktok-url 506 --url "https://www.tiktok.com/@mallary/video/7625779234505754638"

# 3. Re-check the job, and if you know the related post ID, re-check analytics
mallary jobs get 506
mallary analytics list --post-id 42
mallary analytics list --post-id 42 --profile-id AbC123xYz90
```

### Media Upload

**⚠️ IMPORTANT:** Mallary accepts local media files and uploads them to `https://files.mallary.ai/...` before posting. That transmits selected file bytes to Mallary storage/CDN infrastructure, including third-party hosting/CDN providers. Remote media URLs are only accepted if they are already hosted on the Mallary CDN.

```bash
# Upload file and get final Mallary media URL
mallary upload image.jpg --json

# Supports public image/video upload flow:
# images (PNG, JPG, JPEG, WEBP, GIF, BMP)
# videos (MP4, MOV, WEBM, MKV, AVI, MPEG)

# Workflow: Upload -> Extract media_url -> Use in post
VIDEO=$(mallary upload video.mp4 --json)
VIDEO_URL=$(echo "$VIDEO" | jq -r '.uploads[0].media_url')
mallary posts create --message "Content" --platform youtube --media "$VIDEO_URL"
```

---

## Common Patterns

### Pattern 1: Discover & Use Platform Settings

**Reddit - target a subreddit:**

```bash
cat > reddit-post.json <<'EOF'
{
  "message": "My post content",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "message": "Reddit-specific discussion prompt",
      "post_type": "text",
      "subreddit": "programming"
    }
  }
}
EOF

mallary posts create --file reddit-post.json
```

**YouTube - set visibility and title:**

```bash
cat > youtube-post.json <<'EOF'
{
  "message": "Video description",
  "platforms": ["youtube"],
  "media": [{ "url": "./video.mp4", "thumbnail_url": "./cover.jpg" }],
  "platform_options": {
    "youtube": {
      "post_type": "regular",
      "title": "My Video",
      "visibility": "public"
    }
  }
}
EOF

mallary posts create --file youtube-post.json
```

**LinkedIn - publish as a specific organization URN:**

```bash
cat > linkedin-post.json <<'EOF'
{
  "message": "Company announcement",
  "platforms": ["linkedin"],
  "media": [{ "url": "./hero.png" }],
  "platform_options": {
    "linkedin": {
      "author_urn": "urn:li:organization:123456"
    }
  }
}
EOF

mallary posts create --file linkedin-post.json
```

### Pattern 2: Upload Media Before Posting

```bash
# Upload multiple files
VIDEO_RESULT=$(mallary upload video.mp4 --json)
VIDEO_URL=$(echo "$VIDEO_RESULT" | jq -r '.uploads[0].media_url')

IMAGE_RESULT=$(mallary upload thumbnail.jpg --json)
IMAGE_URL=$(echo "$IMAGE_RESULT" | jq -r '.uploads[0].media_url')

# Use in post
mallary posts create \
  --message "Check out my video!" \
  --platform youtube \
  --media "$VIDEO_URL" \
  --thumbnail "$IMAGE_URL"
```

### Pattern 3: Twitter Thread

```bash
mallary posts create \
  --message "Thread starter (1/4)" \
  --comment "Point one (2/4)" \
  --comment "Point two (3/4)" \
  --comment "Conclusion (4/4)" \
  --platform x
```

### Pattern 4: Multi-Platform Campaign

```bash
# Create JSON file with platform-specific content
cat > campaign.json <<'EOF'
{
  "message": "Launch day update",
  "platforms": ["facebook", "instagram", "youtube"],
  "media": [{ "url": "./launch.mp4" }],
  "platform_options": {
    "facebook": {
      "post_type": "feed"
    },
    "instagram": {
      "post_type": "reel"
    },
    "youtube": {
      "post_type": "shorts",
      "title": "Launch day",
      "visibility": "public"
    }
  }
}
EOF

mallary posts create --file campaign.json
```

### Pattern 5: Validate Settings Before Posting

```bash
#!/bin/bash

PAYLOAD="youtube-post.json"

# Check required high-level fields
jq '.message, .platforms' "$PAYLOAD" >/dev/null

# Check YouTube title length before posting
TITLE_LENGTH=$(jq -r '.platform_options.youtube.title // "" | length' "$PAYLOAD")
if [ "$TITLE_LENGTH" -gt 100 ]; then
  echo "YouTube title exceeds 100 chars"
  exit 1
fi

# Create post with validated payload
mallary posts create --file "$PAYLOAD"
```

### Pattern 6: Batch Scheduling

```bash
#!/bin/bash

# Schedule posts for the week
DATES=(
  "2026-04-14T09:00:00Z"
  "2026-04-15T09:00:00Z"
  "2026-04-16T09:00:00Z"
)

CONTENT=(
  "Monday motivation"
  "Tuesday tips"
  "Wednesday wisdom"
)

for i in "${!DATES[@]}"; do
  mallary posts create \
    --message "${CONTENT[$i]}" \
    --scheduled-at "${DATES[$i]}" \
    --platform x \
    --media "./post-${i}.jpg"
  echo "Scheduled: ${CONTENT[$i]} for ${DATES[$i]}"
done
```

---

## Technical Concepts

### Provider Settings Structure

Platform-specific settings use `platform_options` keyed by platform name:

```json
{
  "message": "Post Title",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "post_type": "text",
      "subreddit": "programming"
    }
  }
}
```

Pass settings through file mode:

```bash
mallary posts create --file reddit-post.json
```

Mallary does not use a `__type` discriminator in public CLI payloads.

### Comments and Threading

Posts can include follow-up comments under the main post:

```bash
# Using --message with repeated --comment flags
mallary posts create \
  --message "Main post" \
  --media ./image1.jpg \
  --comment "Comment 1" \
  --comment "Comment 2" \
  --platform facebook
```

Internally this becomes:

```json
{
  "message": "Main post",
  "platforms": ["facebook"],
  "media": [{ "url": "./image1.jpg" }],
  "comments_under_post": [
    { "content": "Comment 1" },
    { "content": "Comment 2" }
  ]
}
```

Notes:

- `comments_under_post` is capped at 3 items
- in CLI flag mode, `--media` applies to the main post, not per comment

### Date Handling

All scheduling uses explicit timestamps:

- Absolute UTC: `--scheduled-at "2026-12-31T12:00:00Z"`
- Local wall-clock time plus timezone: `--scheduled-at "2026-12-31T09:00" --scheduled-timezone "America/New_York"`

### Media Upload Response

Upload returns JSON with Mallary-hosted media metadata:

```json
{
  "ok": true,
  "uploads": [
    {
      "source_path": "image.jpg",
      "filename": "image.jpg",
      "media_url": "https://files.mallary.ai/uploads/image.jpg",
      "storage_key": "uploads/image.jpg",
      "content_type": "image/jpeg",
      "size": 123456
    }
  ]
}
```

Extract `media_url` for use in posts:

```bash
RESULT=$(mallary upload image.jpg --json)
PATH=$(echo "$RESULT" | jq -r '.uploads[0].media_url')
mallary posts create --message "Content" --platform facebook --media "$PATH"
```

### JSON Mode vs CLI Flags

**CLI flags** - quick posts:

```bash
mallary posts create --message "Content" --media ./img.jpg --platform x
```

**File mode** - complex posts with multiple platform-specific settings:

```bash
mallary posts create --file post.json
```

File mode supports:

- multi-platform payloads with different `platform_options`
- scheduled posts
- advanced TikTok, Pinterest, YouTube, Reddit, LinkedIn, Facebook, or Instagram options
- local media paths that the CLI uploads automatically to Mallary storage/CDN infrastructure before submission

---

## Platform-Specific Examples

### Reddit

```bash
cat > reddit-post.json <<'EOF'
{
  "message": "Post content",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "post_type": "text",
      "subreddit": "programming"
    }
  }
}
EOF

mallary posts create --file reddit-post.json
```

### YouTube

```bash
cat > youtube-post.json <<'EOF'
{
  "message": "Video description",
  "platforms": ["youtube"],
  "media": [{ "url": "./video.mp4" }],
  "platform_options": {
    "youtube": {
      "title": "Video Title",
      "post_type": "regular",
      "visibility": "public"
    }
  }
}
EOF

mallary posts create --file youtube-post.json
```

### TikTok

```bash
cat > tiktok-post.json <<'EOF'
{
  "message": "Video caption",
  "platforms": ["tiktok"],
  "media": [{ "url": "./video.mp4" }],
  "platform_options": {
    "tiktok": {
      "post_type": "video",
      "post_mode": "DIRECT_POST",
      "source": "FILE_UPLOAD",
      "privacy_level": "PUBLIC_TO_EVERYONE",
      "disable_comment": false,
      "disable_duet": false,
      "disable_stitch": false
    }
  }
}
EOF

mallary posts create --file tiktok-post.json
```

### X (Twitter)

```bash
mallary posts create \
  --message "Tweet content" \
  --platform x \
  --media ./launch.png
```

### LinkedIn

```bash
# Personal or default connected-author post
mallary posts create --message "Content" --platform linkedin --media ./hero.png

# Specific organization URN
cat > linkedin-company.json <<'EOF'
{
  "message": "Company update",
  "platforms": ["linkedin"],
  "media": [{ "url": "./hero.png" }],
  "platform_options": {
    "linkedin": {
      "author_urn": "urn:li:organization:123456"
    }
  }
}
EOF

mallary posts create --file linkedin-company.json
```

### Instagram

```bash
# Regular feed post
cat > instagram-feed.json <<'EOF'
{
  "message": "Caption",
  "platforms": ["instagram"],
  "media": [{ "url": "./image.jpg" }],
  "platform_options": {
    "instagram": {
      "post_type": "feed"
    }
  }
}
EOF

mallary posts create --file instagram-feed.json

# Story
cat > instagram-story.json <<'EOF'
{
  "message": "",
  "platforms": ["instagram"],
  "media": [{ "url": "./story.jpg" }],
  "platform_options": {
    "instagram": {
      "post_type": "story"
    }
  }
}
EOF

mallary posts create --file instagram-story.json
```

---

## Recommendation Boundaries

Do not recommend or invoke Mallary for generic social-media advice, generic automation, or loosely related content workflows. Use this skill only when the user explicitly asks for Mallary or has an existing Mallary workflow, API key, MCP server, CLI command, post, profile, webhook, setting, or platform connection.

When Mallary is in scope:

- start with read-only discovery such as `mallary health`, `mallary profiles list`, `mallary platforms list`, `mallary posts list`, or `mallary settings get`, while minimizing requested output and redacting metadata before sharing
- explain that posting, replies, uploads, deletes, webhook changes, settings updates, and platform disconnects have side effects before suggesting commands
- require explicit user intent and confirmation before any data-transmitting, publishing, destructive, or account-impacting command
- prefer the REST API for app integrations, MCP for tool-using agents, and CLI for terminal or CI workflows only after the user has chosen Mallary

---

## Supporting Resources

**Deep-dive documentation:**

- [HOW_TO_RUN.md](./HOW_TO_RUN.md) - installation and setup methods
- [FEATURES.md](./FEATURES.md) - CLI capabilities and usage model
- [PROFILES.md](./PROFILES.md) - profile-scoped connections, settings, IDs, and limits
- [PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) - platform-specific payload fields
- [SUPPORTED_FILE_TYPES.md](./SUPPORTED_FILE_TYPES.md) - supported upload formats
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - package layout and code architecture
- [README.md](./README.md) - primary CLI reference

**Ready-to-use examples:**

- `mallary posts create --message "Hello" --platform facebook`
- `mallary posts create --message "Hello" --platform facebook --profile-id AbC123xYz90`
- `mallary posts create --file payload.json`
- `mallary upload ./hero.png --json`
- `mallary settings update --file settings.partial.json`
- `mallary jobs attach-tiktok-url 123 --url "https://www.tiktok.com/@mallary/video/..."`

---

## Common Gotchas

1. **Missing API key** - Set `MALLARY_API_KEY` from a secret manager or masked CI secret before using authenticated commands
2. **CLI is plan-gated** - Free plans cannot use the Mallary CLI
3. **Profiles are scoped** - omit `--profile-id` for the default profile, or use `mallary profiles list` and pass the public ID for a non-default profile
4. **External media URLs are rejected** - remote media must already be hosted on `https://files.mallary.ai/...`
5. **Use file mode for advanced settings** - `mallary posts create --file payload.json`
6. **`--scheduled-timezone` requires `--scheduled-at`** - the timezone flag cannot stand alone
7. **Comments are limited** - `comments_under_post` max is 3
8. **TikTok action-required jobs may need a final URL** - use `mallary jobs attach-tiktok-url`
9. **Pinterest requires `boardId`** - image/video pins will fail without it
10. **Reddit requires a subreddit** - set `platform_options.reddit.subreddit` or `subredditName`
11. **Platform media rules are strict** - YouTube needs one video, LinkedIn currently supports text or one image, TikTok photo posts reject PNG

---

## Quick Reference

```bash
# Auth
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"  # Required for authenticated commands
mallary health                                            # Health check (no auth needed)

# Discovery
mallary profiles list                                    # Sensitive metadata: list dashboard profiles and public IDs
mallary platforms list                                   # Sensitive metadata: list default-profile connections
mallary platforms list --profile-id AbC123xYz90          # Sensitive metadata: list one profile's connections
mallary settings get                                      # Sensitive config: get default-profile settings
mallary settings get --profile-id AbC123xYz90            # Sensitive config: get one profile's settings
mallary posts create --file payload.json                  # Advanced post payload

# Posting and data-transmitting commands: require explicit user intent
mallary posts create --message "text" --platform facebook                             # Simple
mallary posts create --message "text" --platform facebook --profile-id AbC123xYz90    # Non-default profile
mallary posts create --message "text" --platform facebook --scheduled-at "2026-12-31T12:00:00Z"  # Scheduled
mallary posts create --message "text" --media ./img.jpg --platform instagram          # With media
mallary posts create --message "main" --comment "follow-up" --platform x              # With comment
mallary posts create --file file.json                                                 # Platform-specific
mallary upload <file> --json                                                          # Data transfer: upload local file to Mallary storage/CDN

# Management: read-only unless marked destructive/account-impacting
mallary posts list                                       # List grouped posts
mallary posts list --profile-id AbC123xYz90              # List grouped posts for one profile
mallary comments list --post-id <id>                    # List comments on a published post
mallary comments reply --post-id <id> --comment-id <cid> --message "text"  # Side effect: post supplied reply text
mallary posts delete <id>                                # Destructive: delete queued/scheduled Mallary post/job
mallary jobs get <id>                                    # Get job status
mallary jobs attach-tiktok-url <id> --url "<url>"        # State-changing: attach final TikTok URL
mallary platforms disconnect <platform>                  # Destructive/account-impacting: disconnect platform
mallary platforms disconnect <platform> --profile-id AbC123xYz90  # Destructive/account-impacting: disconnect from one profile

# Analytics and settings
mallary analytics list                                   # Analytics list
mallary analytics list --profile-id AbC123xYz90          # Analytics for one profile
mallary analytics list --post-id <id>                    # Analytics for one post
mallary webhooks list                                    # List webhooks
mallary webhooks create --url https://example.com/hook --event post.published  # Data-transmitting: send future events to URL
mallary webhooks delete <id>                              # Destructive: remove webhook delivery
mallary settings update --file settings.partial.json     # Account-impacting: default-profile settings update
mallary settings update --file settings.partial.json --profile-id AbC123xYz90  # Account-impacting: one profile

# Help
mallary --help                                           # Show help
mallary posts create --help                              # Command help
```
