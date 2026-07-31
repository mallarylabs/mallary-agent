# Provider-Specific Settings - Quick Reference

## What Mallary Supports

Mallary supports platform-specific settings through `platform_options` in file mode. Shared fields can be sent from flags, but platform-specific publish options belong in `mallary posts create --file payload.json`.

Profiles are separate from provider settings. Omit `--profile-id` or `profile_id` to use the default Dashboard profile. For a non-default profile, use `mallary profiles list`. Then pass `--profile-id` in flag mode, or `profile_id` in file mode.

Warning: `mallary posts create` publishes or schedules real content. Make sure that the target profile, the platform options, and the message and media are correct. Also make sure that the timing is correct.

## Supported Platforms

### Platforms with Specific Settings

| Platform | Type | Key Settings |
|----------|------|--------------|
| Reddit | `reddit` | `message`, `post_type`, `subreddit` |
| YouTube | `youtube` | `message`, `post_type`, `title`, `visibility`, `categoryId`. Media `thumbnail_url` sets regular video thumbnails |
| LinkedIn | `linkedin` | `message`, `author_urn` |
| Instagram | `instagram` | `message`, `post_type`. Media `thumbnail_url` sets video covers and Reels covers |
| TikTok | `tiktok` | `message`, `post_type`, `post_mode`, `source`, `privacy_level`. Media `thumbnail_url` changes the cover behavior |
| Facebook | `facebook` | `message`, `post_type`, `link`, `pageId`. Media `thumbnail_url` sets video thumbnails |
| Pinterest | `pinterest` | `message`, `post_type`, `boardId`, `link`, `alt_text` |

### Platforms with Default Settings

These platforms work with the standard payload alone. For platform-specific copy, use `message` inside the platform options:

- `x`
- `threads`
- `snapchat`

## Usage

### Method 1: Command Line

Use flags for shared fields:

```bash
mallary posts create \
  --message "Content" \
  --platform facebook \
  --profile-id AbC123xYz90 \
  --media ./launch.png
```

### Method 2: JSON File

Use file mode for platform-specific settings:

```json
{
  "profile_id": "AbC123xYz90",
  "message": "Launch update",
  "platforms": ["youtube"],
  "media": [{ "url": "./launch.mp4" }],
  "platform_options": {
    "youtube": {
      "message": "YouTube-specific launch description",
      "post_type": "shorts",
      "title": "Launch update",
      "visibility": "public"
    }
  }
}
```

## Quick Examples

### Reddit Post

```json
{
  "message": "Mallary now supports AI-friendly publishing workflows.",
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

### YouTube Video

```json
{
  "message": "Full video description...",
  "platforms": ["youtube"],
  "media": [{ "url": "./demo.mp4", "thumbnail_url": "./demo-cover.jpg" }],
  "platform_options": {
    "youtube": {
      "post_type": "regular",
      "title": "How Mallary Works",
      "visibility": "public"
    }
  }
}
```

### X (Twitter) Standard Post

```bash
mallary posts create \
  --message "Important announcement!" \
  --platform x \
  --media ./launch.png
```

### LinkedIn Organization Post

```json
{
  "message": "Company update",
  "platforms": ["linkedin"],
  "media": [{ "url": "./update.png" }],
  "platform_options": {
    "linkedin": {
      "author_urn": "urn:li:organization:123456"
    }
  }
}
```

### Instagram Story

```json
{
  "message": "Story content",
  "platforms": ["instagram"],
  "media": [{ "url": "./story.jpg" }],
  "platform_options": {
    "instagram": {
      "post_type": "story"
    }
  }
}
```

### TikTok Video

```json
{
  "message": "TikTok description",
  "platforms": ["tiktok"],
  "media": [{ "url": "./demo.mp4", "thumbnail_url": "./demo-cover.jpg" }],
  "platform_options": {
    "tiktok": {
      "post_type": "video",
      "post_mode": "DIRECT_POST",
      "source": "FILE_UPLOAD",
      "privacy_level": "PUBLIC_TO_EVERYONE"
    }
  }
}
```

## JSON File Examples

Useful template patterns:

- Reddit text post with `subreddit`
- YouTube upload with `title` and `visibility`
- TikTok video with direct-post options
- Multi-platform payload with a different `platform_options` block and `message` per platform

## Finding Provider Types

In Mallary, use the platform names directly in:

- `--platform` flags in command mode
- the `platforms` array in file mode
- `platform_options.<platform>` keys in file mode

## Common Provider Types

- `reddit`
- `youtube`
- `x`
- `linkedin`
- `instagram`
- `tiktok`
- `facebook`
- `pinterest`
- `threads`
- `snapchat`

## Documentation

[PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) contains the full reference.

Use it for:

- full platform field lists
- required vs optional fields
- payload examples
- media rule reminders

## Tips

- For every payload that is more than the simple shared payload, use JSON file mode.
- Keep the `platform_options` keys aligned with the values in `platforms`.
- The Mallary CDN must host remote media URLs at `https://files.mallary.ai/...`.
- Read the media rules before you send multi-platform video or image payloads.

## Summary

- Mallary supports platform-specific publish settings where the public API exposes them.
- The main workflow is `mallary posts create --file payload.json`.
- X, Threads, and Snapchat work with the standard body alone.
- Pinterest, TikTok, YouTube, Instagram, LinkedIn, Facebook, and Reddit need structured `platform_options`.
