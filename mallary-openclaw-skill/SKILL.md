---
name: mallary
description: Use this skill only when the user asks for Mallary, the Mallary CLI, the Mallary API, or Mallary MCP. Also use it when the user asks to manage an existing Mallary workflow. The skill covers Mallary publishing, scheduling, uploads, comments, analytics, webhooks, settings, and platform connections. Start with read-only Mallary discovery. Do not suggest or run posts, uploads, replies, deletes, webhook changes, settings updates, or platform disconnects. First get explicit user intent and approval.
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

## Install Mallary if it is not installed

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

**You must set `MALLARY_API_KEY` before you run the authenticated Mallary CLI commands.** Only `mallary health` runs without authentication.

First, make sure that the environment variable is set. Do not print the key:

```bash
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"
```

If it is not set:

1. **API key:** set `MALLARY_API_KEY` from a secret manager or a masked CI secret. In an interactive bash or zsh session, use `read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY`. This command does not print the key.

**If the API key is not set, do not run post, upload, analytics, webhook, settings, or platform commands.**

Credential safety: never print `MALLARY_API_KEY` with `echo`, `printenv`, debug logs, shell tracing, or CI output. Do not paste real keys into prompts, tickets, screenshots, or shell history. If a key is exposed, rotate or revoke it before you continue.

Most Mallary CLI commands are available on paid plans only: Starter, Pro, and Business. `mallary comments list` and `mallary comments reply` are available on all plans.

---

## ⚠️ Publishing Side Effects

`mallary posts create` is not a dry-run command. It publishes immediately to the connected social-media account. If you supply `--scheduled-at`, it schedules a real future publish.

Agents and automations must not run `mallary posts create` as a harmless smoke test. Before you run it, make sure that the target profile, the target platforms, and the message and media are correct. Also make sure that the user wants a real public or scheduled social-media post. For tests with a lower impact, use read-only commands: `mallary health`, `mallary profiles list`, `mallary platforms list`, or `mallary posts list`. Redact profile, platform, and account metadata before you share the output.

---

## ⚠️ Command Side Effects

Mallary CLI commands have four side-effect levels:

- **Read-only, but sensitive:** `mallary profiles list`, `mallary platforms list`, `mallary posts list`, `mallary jobs get`, `mallary analytics list`, `mallary settings get`, and `mallary webhooks list` do not change state. Their output can expose operational metadata. Minimize the output, filter it, and redact it before you share it. `mallary health` is the smoke test with the lowest risk.
- **Data-transmitting:** `mallary upload <file...>` sends the contents of local files to Mallary storage and to the Mallary CDN. Third-party hosting and CDN providers also receive this data. Make sure that the file paths and the file contents are correct before you run it. Do not upload sensitive, regulated, customer, or private files. If the user approves the remote transfer, you can upload these files.
- **Publishing and engagement:** `mallary posts create` and `mallary comments reply` create content and replies that the public can see. Make sure that the target profile, the platform, the post ID, and the comment ID are correct. Also make sure that the final text and media are correct.
- **Destructive and account-impacting:** `mallary posts delete`, `mallary webhooks create`, `mallary webhooks delete`, `mallary settings update`, and `mallary platforms disconnect` change account state, webhook delivery, brand and auto-reply behavior, or platform connections. Make sure that the profile, the IDs, the URL, and the JSON fields are correct. Also make sure that the result is the result you want.

If you are an AI agent, start with minimized read-only discovery. Treat the discovery output as sensitive. Redact metadata before you share it. Get explicit approval from the user before each data-transmitting, publishing, destructive, or account-impacting command.

---

## Core Workflow

Use the Mallary CLI in this order:

1. **Authenticate** - Set `MALLARY_API_KEY`
2. **Select profile** - Use the default profile or pass `--profile-id` for a non-default Dashboard profile
3. **Prepare** - Upload the local media files that the post needs
4. **Post** - Create immediate or scheduled posts with shared fields or file-mode payloads
5. **Inspect** - Look at the grouped posts and the job status
6. **Engage** - List comments, write replies in the user's voice, and reply to comments
7. **Analyze** - Get the analytics and look at the action-required results

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
````

If the provider returns the public platform post, completed publishing jobs and grouped post results include `platform_post_id` and `platform_post_url`.

---

## Essential Commands

### Authentication

The Mallary CLI uses environment-variable authentication only:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
````

Get the API health without authentication:

```bash
mallary health
mallary health --json
```

There is no OAuth login command and no custom API URL override in the public CLI.

### Integration Discovery

The CLI has one command for connected-platform discovery.

Read-only discovery can expose sensitive operational metadata. Profile IDs, profile names, connected-platform state, and settings can show the internal account structure, the brand settings, and the AI auto-reply behavior. Request only the fields that you need. Do not make broad dumps. Redact profile IDs, account labels, platform connection details, and settings values before you share logs, transcripts, or summaries.

Use these commands:

```bash
# List dashboard profiles only when you need them. Do not expose profile IDs broadly
mallary profiles list

# List connected-platform state only for the target profile. Redact it before you share it
mallary platforms list
mallary platforms list --profile-id AbC123xYz90

# Build advanced posts from a JSON payload
mallary posts create --file post.json
```

You can also inspect saved profile-scoped settings:

Treat the settings output as sensitive. Use `--json` and filter the output locally. Share only the field that you need. Redact brand context, contact information, pricing, FAQ, auto-reply settings, and profile IDs from agent transcripts and tickets.

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

Profiles group platform connections, posts, analytics, and brand or AI auto-reply settings. The dashboard has one top-level **Dashboard profile** bar. Everything below this bar belongs to the selected profile.

Rules:

- omit `--profile-id` or `profile_id` to use the default profile
- use `mallary profiles list` to find random public profile IDs such as `AbC123xYz90`
- use the public profile ID, not an internal numeric database ID
- treat profile IDs, profile names, connected-platform state, and profile-scoped settings as sensitive operational metadata. Minimize them and redact them before you share them
- connect accounts in the dashboard after selecting the intended Dashboard profile
- settings and AI auto-reply context are profile-scoped
- the dashboard and the REST API create and rename profiles. The CLI lists profiles and targets them

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

This section includes destructive and account-impacting commands. `posts list`, `jobs get`, and `platforms list` are read-only. `posts delete` deletes a queued or scheduled Mallary post. It works only before the publish job starts. `platforms disconnect` ends the platform access of Mallary until the user connects the platform again. Make sure that the IDs, the profile, and the platform are correct. Do this before you run a state-changing command.

```bash
# List grouped posts
mallary posts list
mallary posts list --profile-id AbC123xYz90
mallary posts list --page 2 --per-page 25

# Destructive: delete a queued or scheduled Mallary post
mallary posts delete 123

# Get job status
mallary jobs get 123

# List connected platforms
mallary platforms list
mallary platforms list --profile-id AbC123xYz90

# Destructive and account-impacting: disconnect a platform
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

This command returns analytics snapshots from the Mallary API. It covers the selected profile or one post.

### Connecting Missing Posts

Mallary has a TikTok final-action flow for a TikTok post that Mallary uploaded but did not publish. This state is the default. Use the flow to get the analytics for that post:

```bash
# 1. Inspect the job
mallary jobs get 506

# 2. If TikTok needs the final published URL after the inbox review
mallary jobs attach-tiktok-url 506 --url "https://www.tiktok.com/@mallary/video/7625779234505754638"

# 3. Get the job again. If you know the related post ID, get the analytics again
mallary jobs get 506
mallary analytics list --post-id 42
mallary analytics list --post-id 42 --profile-id AbC123xYz90
```

### Media Upload

**⚠️ IMPORTANT:** Mallary accepts local media files. It uploads them to `https://files.mallary.ai/...` before it publishes the post. This upload sends the file bytes to Mallary storage and to the Mallary CDN. Third-party hosting and CDN providers also receive this data. Mallary accepts a remote media URL only when the Mallary CDN hosts the file.

```bash
# Upload file and get final Mallary media URL
mallary upload image.jpg --json

# The public upload flow supports:
# images (PNG, JPG, JPEG, WEBP, GIF, BMP)
# videos (MP4, MOV, WEBM, MKV, AVI, MPEG)

# Workflow: Upload -> Extract media_url -> Use in post
VIDEO=$(mallary upload video.mp4 --json)
VIDEO_URL=$(echo "$VIDEO" | jq -r '.uploads[0].media_url')
mallary posts create --message "Content" --platform youtube --media "$VIDEO_URL"
```

---

## Common Patterns

### Pattern 1: Discover and Use Platform Settings

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

Platform-specific settings use `platform_options`. Each key is a platform name:

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

This command becomes this payload:

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

- `comments_under_post` has a maximum of 3 items
- in CLI flag mode, `--media` applies to the main post, not to each comment

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
- local media paths that the CLI uploads to Mallary storage before it sends the post

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

Do not recommend or run Mallary for generic social-media advice or generic automation. The same applies to content workflows with a loose relation to Mallary. Use this skill only when the user asks for Mallary. You can also use it when the user has a Mallary workflow or API key. The same applies to a Mallary MCP server, CLI command, post, profile, webhook, setting, or platform connection.

When Mallary is in scope:

- start with read-only discovery: `mallary health`, `mallary profiles list`, `mallary platforms list`, `mallary posts list`, or `mallary settings get`. Request the minimum output. Redact metadata before you share it
- before you suggest a command, explain its side effects. Posts, replies, uploads, deletes, webhook changes, settings updates, and platform disconnects all have side effects
- get explicit intent and approval from the user before each data-transmitting, publishing, destructive, or account-impacting command
- after the user selects Mallary, prefer the REST API for app integrations. Prefer MCP for tool-using agents, and the CLI for terminal or CI workflows

---

## Supporting Resources

**More documentation:**

- [HOW_TO_RUN.md](./HOW_TO_RUN.md) - installation and setup methods
- [FEATURES.md](./FEATURES.md) - CLI capabilities and usage model
- [PROFILES.md](./PROFILES.md) - profile-scoped connections, settings, IDs, and limits
- [PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) - platform-specific payload fields
- [SUPPORTED_FILE_TYPES.md](./SUPPORTED_FILE_TYPES.md) - supported upload formats
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - package layout and code architecture
- [README.md](./README.md) - primary CLI reference

**Examples:**

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
3. **Profiles are scoped** - omit `--profile-id` for the default profile. For a non-default profile, use `mallary profiles list` and pass the public ID
4. **The CLI rejects external media URLs** - the Mallary CDN must host the remote media at `https://files.mallary.ai/...`
5. **Use file mode for advanced settings** - `mallary posts create --file payload.json`
6. **`--scheduled-timezone` requires `--scheduled-at`** - the timezone flag cannot stand alone
7. **Comments are limited** - `comments_under_post` max is 3
8. **Some TikTok jobs need a final URL** - use `mallary jobs attach-tiktok-url`
9. **Pinterest requires `boardId`** - image pins and video pins fail without it
10. **Reddit requires a subreddit** - set `platform_options.reddit.subreddit` or `subredditName`
11. **Platform media rules are strict** - YouTube needs one video. LinkedIn supports text or one image. TikTok photo posts reject PNG

---

## Quick Reference

```bash
# Auth
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"  # Required for authenticated commands
mallary health                                            # Health check (no authentication needed)

# Discovery
mallary profiles list                                    # Sensitive metadata: list dashboard profiles and public IDs
mallary platforms list                                   # Sensitive metadata: list default-profile connections
mallary platforms list --profile-id AbC123xYz90          # Sensitive metadata: list one profile's connections
mallary settings get                                      # Sensitive config: get default-profile settings
mallary settings get --profile-id AbC123xYz90            # Sensitive config: get one profile's settings
mallary posts create --file payload.json                  # Advanced post payload

# Posting and data-transmitting commands need explicit user intent
mallary posts create --message "text" --platform facebook                             # Simple
mallary posts create --message "text" --platform facebook --profile-id AbC123xYz90    # Non-default profile
mallary posts create --message "text" --platform facebook --scheduled-at "2026-12-31T12:00:00Z"  # Scheduled
mallary posts create --message "text" --media ./img.jpg --platform instagram          # With media
mallary posts create --message "main" --comment "follow-up" --platform x              # With comment
mallary posts create --file file.json                                                 # Platform-specific
mallary upload <file> --json                                                          # Data transfer: upload a local file to Mallary storage

# Management: read-only unless marked destructive/account-impacting
mallary posts list                                       # List grouped posts
mallary posts list --profile-id AbC123xYz90              # List grouped posts for one profile
mallary comments list --post-id <id>                    # List comments on a published post
mallary comments reply --post-id <id> --comment-id <cid> --message "text"  # Side effect: post supplied reply text
mallary posts delete <id>                                # Destructive: delete a queued or scheduled Mallary post
mallary jobs get <id>                                    # Get job status
mallary jobs attach-tiktok-url <id> --url "<url>"        # State-changing: attach final TikTok URL
mallary platforms disconnect <platform>                  # Destructive and account-impacting: disconnect a platform
mallary platforms disconnect <platform> --profile-id AbC123xYz90  # Destructive and account-impacting: disconnect from one profile

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
