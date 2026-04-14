# Mallary CLI - Feature Summary

## Complete Feature Set

Mallary CLI is the official command-line interface for Mallary.ai. It is designed for developers, operators, CI jobs, and AI agents that need to upload media, create posts, inspect jobs, fetch analytics, manage webhooks, update brand settings, list connected platforms, and disconnect platforms from one command surface.

The CLI mirrors the public Mallary API. It does not bypass plan limits, feature gates, connected-account requirements, or platform validation rules.

### Posts with Comments and Media - FULLY SUPPORTED

Mallary supports both simple post creation and advanced payload-based publishing.

#### Posts with Comments

- You can attach follow-up comments with repeatable `--comment` flags in flag mode.
- In file mode, use `comments_under_post` in the JSON payload.
- The public API currently limits follow-up comments to 3 items.

#### Multiple Media per Post/Comment

- Mallary supports multi-media posts where the target platform allows it.
- Local file paths are uploaded automatically before the post request is sent.
- Remote third-party media URLs are rejected by the CLI.
- Already-hosted `https://files.mallary.ai/...` URLs are allowed.

#### Multi-Platform Posting

- One `posts create` request can target multiple platforms at once.
- Use repeatable `--platform` flags in flag mode.
- Use the `platforms` array in file mode.
- Platform-specific behavior can be customized in file mode with `platform_options`.

#### Advanced Features

- Automatic local file upload before post creation
- Absolute or timezone-aware scheduling
- Idempotency keys
- Optional per-post AI auto reply flag
- Job inspection
- Analytics fetching
- Webhook management
- Settings read/update
- Connected platform listing
- TikTok post URL attachment for inbox-style TikTok workflows

## Usage Modes

Mallary supports two main ways to create content.

### 1. Simple Mode (Command Line)

For quick, simple posts:

```bash
# Single post
mallary posts create --message "Hello!" --platform facebook

# With multiple images
mallary posts create --message "Post" --platform x --media ./img1.jpg --media ./img2.jpg --media ./img3.jpg

# With follow-up comments
mallary posts create --message "Main" --platform facebook --comment "Comment 1" --comment "Comment 2"
```

### 2. Advanced Mode (JSON Files)

Use `--file` when you need platform-specific fields or a raw JSON payload.

```bash
mallary posts create --file complex-post.json
```

Advanced mode is best when:

- you need `platform_options`
- you want to preserve a reusable payload file
- an AI agent is assembling a complex request
- you are mixing scheduling, media, comments, and platform-specific settings

## Real-World Examples

### Example 1: Product Launch with Follow-up Comments

```json
{
  "message": "We just shipped a new workflow for teams and AI agents.",
  "platforms": ["facebook", "linkedin", "x"],
  "media": [{ "url": "./launch.png" }],
  "comments_under_post": [
    { "content": "Docs are live now." },
    { "content": "Questions? Reply here and we will answer them." }
  ]
}
```

### Example 2: Tutorial Thread

```json
{
  "message": "Mallary CLI can upload local media automatically before publishing.",
  "platforms": ["x"],
  "media": [{ "url": "./step-1.png" }],
  "comments_under_post": [
    { "content": "Step 1: upload local files or pass Mallary-hosted URLs." },
    {
      "content": "Step 2: use platform_options in file mode for advanced settings."
    },
    { "content": "Step 3: inspect jobs and analytics after publishing." }
  ]
}
```

### Example 3: Multi-Platform Campaign

```json
{
  "message": "Launch update",
  "platforms": ["facebook", "instagram", "youtube", "pinterest"],
  "media": [{ "url": "./launch.mp4" }],
  "scheduled_at": "2026-04-20T14:30",
  "scheduled_timezone": "America/New_York",
  "platform_options": {
    "facebook": {
      "post_type": "feed"
    },
    "instagram": {
      "post_type": "reel"
    },
    "youtube": {
      "post_type": "shorts",
      "title": "Launch update",
      "visibility": "public"
    },
    "pinterest": {
      "post_type": "video",
      "boardId": "920740542650170734"
    }
  }
}
```

## API Structure Reference

Mallary CLI ultimately submits to the Mallary API: `POST /api/v1/post`.

### Complete Create Payload Shape

```ts
type CreatePostPayload = {
  message: string;
  platforms: string[];
  media?: Array<{
    url: string;
    type?: string;
    width?: number;
    height?: number;
    duration?: number;
  }>;
  comments_under_post?: Array<{ content: string }>;
  scheduled_at?: string;
  scheduled_timezone?: string;
  webhook_url?: string;
  auto_reply_enabled?: boolean;
  platform_options?: {
    facebook?: {
      post_type?: "feed" | "story";
      link?: string;
      pageId?: string;
    };
    instagram?: {
      post_type?: "feed" | "story" | "reel" | "carousel";
    };
    linkedin?: {
      author_urn?: string;
    };
    youtube?: {
      post_type?: "regular" | "shorts";
      title?: string;
      visibility?: "public" | "unlisted" | "private";
      categoryId?: string;
      madeForKids?: boolean;
    };
    tiktok?: {
      post_type?: "video" | "photo";
      post_mode?: "DIRECT_POST" | "MEDIA_UPLOAD";
      source?: "FILE_UPLOAD" | "PULL_FROM_URL";
      privacy_level?: string;
      disable_comment?: boolean;
      disable_duet?: boolean;
      disable_stitch?: boolean;
      video_cover_timestamp_ms?: number;
      title?: string;
      description?: string;
      auto_add_music?: boolean;
      brand_content_toggle?: boolean;
      brand_organic_toggle?: boolean;
      is_aigc?: boolean;
      photo_cover_index?: number;
    };
    pinterest?: {
      post_type?: "image" | "video";
      boardId?: string;
      link?: string;
      alt_text?: string;
    };
    reddit?: {
      post_type?: "text" | "link" | "image";
      subreddit?: string;
      subredditName?: string;
    };
  };
};
```

## For AI Agents

Mallary CLI is intentionally friendly to agents and automation.

### When to Use Simple Mode

- the agent is composing a small, standard post
- local files should be uploaded automatically
- the workflow is shell-first
- human review of the exact CLI command is useful

### When to Use Advanced Mode (JSON)

- the agent needs `platform_options`
- the post spans multiple platforms with different rules
- scheduling, comments, and platform-specific settings are combined
- the payload should be generated and stored as an artifact

### AI Agent Tips

- prefer `--json` output for machine handling
- prefer `posts create --file` for advanced platform payloads
- upload local files through Mallary first or let the CLI do it automatically
- never pass third-party remote media URLs directly to the CLI
- remember that free plans do not include CLI access

## Files and Documentation

- `README.md` - authoritative usage and command reference
- `SKILL.md` - compact agent-facing reference
- `QUICK_START.md` - fast onboarding path
- `PROVIDER_SETTINGS.md` - platform-specific posting fields
- `SUPPORTED_FILE_TYPES.md` - upload behavior and file type notes
- `llms.txt` - compact command inventory and workflow notes for automated systems

## Summary

Mallary CLI supports the complete public Mallary publishing workflow:

- upload local media
- create direct or scheduled posts
- add follow-up comments
- inspect jobs
- fetch analytics
- manage webhooks
- manage brand settings
- list connected platforms
- disconnect platforms
