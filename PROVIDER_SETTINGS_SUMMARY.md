# Provider-Specific Settings - Quick Reference

## What's Supported

Mallary supports platform-specific settings through `platform_options` in file mode. Shared fields can be sent from flags, but platform-specific publish options belong in `mallary posts create --file payload.json`.

## Supported Platforms

### Platforms with Specific Settings

| Platform | Type | Key Settings |
|----------|------|--------------|
| Reddit | `reddit` | `post_type`, `subreddit` |
| YouTube | `youtube` | `post_type`, `title`, `visibility`, `categoryId`. Media `thumbnail_url` sets regular video thumbnails. |
| LinkedIn | `linkedin` | `author_urn` |
| Instagram | `instagram` | `post_type`. Media `thumbnail_url` sets video/Reels covers. |
| TikTok | `tiktok` | `post_type`, `post_mode`, `source`, `privacy_level`. Media `thumbnail_url` changes cover behavior. |
| Facebook | `facebook` | `post_type` (`feed`, `story`, or `reel`), `link`, `pageId`. Reels use one 9:16 MP4/MOV video. Media `thumbnail_url` sets feed video thumbnails. |
| Pinterest | `pinterest` | `post_type`, `boardId`, `link`, `alt_text` |
| Bluesky | `bluesky` | `message`, `languages`. Media `alt_text` adds an accessible description. |

### Platforms with Default Settings

These usually work with the standard payload alone:

- `x`
- `threads`

## Usage

### Method 1: Command Line

Use flags for shared fields:

```bash
mallary posts create \
  --message "Content" \
  --platform facebook \
  --media ./launch.png
```

### Method 2: JSON File

Use file mode for platform-specific settings:

```json
{
  "message": "Launch update",
  "platforms": ["youtube"],
  "media": [{ "url": "./launch.mp4" }],
  "platform_options": {
    "youtube": {
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

### Twitter/X Standard Post

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
- Multi-platform payload with a different `platform_options` block per platform

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
- `bluesky`

## Documentation

[PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) contains the full reference.

Use it for:

- full platform field lists
- required vs optional fields
- payload examples
- media rule reminders

## Tips

- Use JSON file mode for anything beyond the simplest shared payload.
- Keep `platform_options` keys aligned with the values in `platforms`.
- Remote media URLs must already be hosted on `https://files.mallary.ai/...`.
- Check media rules before sending multi-platform video or image payloads.

## Summary

- Mallary supports platform-specific publish settings where the public API exposes them.
- The main workflow is `mallary posts create --file payload.json`.
- X and Threads usually work with the standard body alone.
- Bluesky can use the standard body alone. Add `platform_options.bluesky` when you need a different message or language codes.
- Pinterest, TikTok, YouTube, Instagram, LinkedIn, Facebook, and Reddit often need structured `platform_options`.
