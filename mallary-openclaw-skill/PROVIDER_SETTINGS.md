# Provider-Specific Settings

The Mallary CLI supports platform-specific publishing settings through JSON file mode. Different platforms have different options and media rules. When you need `platform_options`, use `mallary posts create --file payload.json`.

Provider settings are independent of profiles. Omit `--profile-id` or `profile_id` to use the default profile. Use `mallary profiles list` to find the profile ID of a non-default profile. Then pass `--profile-id` in flag mode, or `profile_id` in file mode.

Warning: `mallary posts create` publishes or schedules real content on connected social-media accounts. Make sure that the profile, the platform options, and the message and media are correct. Also make sure that the timing is correct.

## How to Use Provider Settings

### Method 1: Command Line Flags

Use command-line flags for shared fields:

```bash
mallary posts create \
  --message "Your content" \
  --platform facebook \
  --profile-id AbC123xYz90 \
  --media ./launch.png
```

Flag mode covers the common payload only. If you need platform-specific settings such as `boardId`, `visibility`, or `post_type`, switch to file mode.

### Method 2: JSON File

```bash
mallary posts create --file post-with-settings.json
```

In the JSON file, specify platform-specific settings under `platform_options`:

```json
{
  "profile_id": "AbC123xYz90",
  "message": "Post content",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "message": "Reddit-specific discussion prompt",
      "post_type": "text",
      "subreddit": "programming"
    }
  }
}
```

Use `platform_options.<platform>.message` for a platform-specific message or caption. Omit it to use the top-level `message`.

## Supported Platforms & Settings

### Reddit (`reddit`)

Settings:

- `message`: optional Reddit-specific title/text source
- `post_type` (required): `text`, `link`, or `image`
- `subreddit` or `subredditName` (required): target subreddit name

Example:

```json
{
  "message": "Mallary now supports multi-surface publishing.",
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

### YouTube (`youtube`)

Settings:

- `message`: optional YouTube-specific description/default-title source
- `post_type`: `regular` or `shorts`
- `title`: optional custom title
- `visibility`: `public`, `unlisted`, or `private`
- `categoryId`: optional YouTube category id
- `madeForKids`: optional boolean
- `thumbnail_url`: optional on the video media item for regular YouTube videos. Use `jpg`, `jpeg`, or `png` up to 2 MB. Use `1280x720` and the 16:9 ratio. Mallary skips Shorts thumbnails.

Example:

```json
{
  "message": "Watch our latest product walkthrough",
  "platforms": ["youtube"],
  "media": [{ "url": "./walkthrough.mp4", "thumbnail_url": "./walkthrough-cover.jpg" }],
  "platform_options": {
    "youtube": {
      "post_type": "shorts",
      "title": "Mallary walkthrough",
      "visibility": "unlisted",
      "categoryId": "28",
      "madeForKids": false
    }
  }
}
```

### X / Twitter (`x`)

Settings:

- `message`: optional X-specific message

Example:

```json
{
  "message": "Shipping a new feature today.",
  "platforms": ["x"],
  "media": [{ "url": "./launch.png" }],
  "platform_options": {
    "x": {
      "message": "X-specific launch copy"
    }
  }
}
```

### LinkedIn (`linkedin`)

Settings:

- `message`: optional LinkedIn-specific message
- `author_urn` (optional): override the LinkedIn author or organization URN used for publishing

Example:

```json
{
  "message": "Company update from Mallary",
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

### Instagram (`instagram`)

Settings:

- `message`: optional Instagram-specific caption
- `post_type`: `feed`, `story`, `reel`, or `carousel`. Set it for story, reel, and carousel posts.
- `thumbnail_url`: optional on video media items for Instagram video covers and Reels covers. Use a Mallary-hosted image that matches the video placement.
- `story` uses exactly one image or one video. Stories do not support captions or follow-up comments. Put the text in the media.
- `carousel` uses 2 to 10 image or video media items.

Example:

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

### TikTok (`tiktok`)

Settings:

- `message`: optional TikTok-specific caption/title fallback
- `post_type`: `video` or `photo`
- `post_mode`: `DIRECT_POST` or `MEDIA_UPLOAD`
- `source`: `FILE_UPLOAD` or `PULL_FROM_URL` for video posts
- `privacy_level`: optional direct-post override
- `disable_comment`
- `disable_duet`
- `disable_stitch`
- `video_cover_timestamp_ms`
- `thumbnail_url` on video media replaces the timestamp cover behavior of Mallary. TikTok video posts do not accept arbitrary image thumbnails through Mallary.
- `title`
- `description`
- `auto_add_music`
- `brand_content_toggle`
- `brand_organic_toggle`
- `is_aigc`
- `photo_cover_index`
- `thumbnail_url` on photo media selects the cover only when it exactly matches one of the supplied photo URLs

Example:

```json
{
  "message": "New feature demo",
  "platforms": ["tiktok"],
  "media": [{ "url": "./demo.mp4", "thumbnail_url": "./demo-cover.jpg" }],
  "platform_options": {
    "tiktok": {
      "message": "TikTok-specific video caption",
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

### Facebook (`facebook`)

Settings:

- `message`: optional Facebook-specific message/caption
- `post_type`: `feed` or `story`
- `link`: optional destination URL for feed-style link posts
- `pageId`: optional advanced override for a specific connected page
- `thumbnail_url`: optional on video media items. Mallary accepts `jpg`, `jpeg`, or `png` thumbnails up to 10 MB. If Meta rejects the thumbnail, Mallary tries again without it.

Example:

```json
{
  "message": "Read the full announcement",
  "platforms": ["facebook"],
  "platform_options": {
    "facebook": {
      "message": "Facebook caption for this announcement",
      "post_type": "feed",
      "link": "https://mallary.ai/blog"
    }
  }
}
```

### Pinterest (`pinterest`)

Settings:

- `message`: optional Pinterest-specific description/default title source
- `post_type`: `image` or `video`
- `boardId` (required): board id to publish into
- `link`: optional destination URL
- `alt_text`: optional alt text for image pins

Example:

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
      "link": "https://mallary.ai/pricing",
      "alt_text": "Mallary pricing page preview"
    }
  }
}
```

### Threads (`threads`)

Settings:

- `message`: optional Threads-specific message
- `post_type`: optional `text`, `image`, `video`, or `carousel`

Example:

```json
{
  "message": "Posting to Threads from Mallary",
  "platforms": ["threads"],
  "platform_options": {
    "threads": {
      "message": "Threads-specific post copy"
    }
  }
}
```

### Snapchat (`snapchat`)

Settings:

- `message`: optional Snapchat-specific message
- `contentType`: optional `story`, `saved_story`, or `spotlight`

Example:

```json
{
  "message": "Mallary launch update",
  "platforms": ["snapchat"],
  "media": [{ "url": "./story.mp4" }],
  "platform_options": {
    "snapchat": {
      "message": "Snapchat-specific story copy"
    }
  }
}
```

## Platforms Without Specific Settings

These platforms work with the standard Mallary post body alone. For platform-specific copy, use `platform_options.<platform>.message`:

- `x`
- `threads`
- `snapchat`

Alias notes:

- older data can contain `twitter` as an alias for `x`
- older data can contain `meta` as an alias for `facebook`

## Using JSON Files for Complex Settings

### Reddit Example

```json
{
  "message": "Mallary now supports agent-friendly workflows.",
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "post_type": "text",
      "subreddit": "socialmedia"
    }
  }
}
```

Run it with:

```bash
mallary posts create --file ./reddit-post.json
```

### YouTube Example

```json
{
  "message": "Full video description goes here.",
  "platforms": ["youtube"],
  "media": [{ "url": "./launch.mp4" }],
  "platform_options": {
    "youtube": {
      "post_type": "regular",
      "title": "Mallary launch",
      "visibility": "public",
      "madeForKids": false
    }
  }
}
```

### Multi-Platform with Different Settings

```json
{
  "message": "Launch day is here.",
  "platforms": ["facebook", "instagram", "youtube", "pinterest"],
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
    },
    "pinterest": {
      "post_type": "video",
      "boardId": "920740542650170734"
    }
  }
}
```

## Tips

- When you need `platform_options`, use `--file`.
- Keep the `platform_options` keys aligned with the values in `platforms`.
- The CLI uploads local media paths in `media[].url` before it sends the post request.
- The CLI also uploads local thumbnail paths in `media[].thumbnail_url`.
- The Mallary CDN must host remote media URLs at `https://files.mallary.ai/...`.
- The Mallary CDN must also host remote thumbnail URLs at `https://files.mallary.ai/...`.

## Finding Your Platform Name

Use the platform names Mallary expects:

- `facebook`
- `instagram`
- `linkedin`
- `youtube`
- `tiktok`
- `pinterest`
- `reddit`
- `x`
- `threads`
- `snapchat`

In file mode, each `platform_options` key must match the related entry in `platforms`.

## Common Errors

### Missing Platform Options Key

If you send platform-specific settings, the key must match the platform name:

```json
{
  "platforms": ["reddit"],
  "platform_options": {
    "reddit": {
      "post_type": "text",
      "subreddit": "socialmedia"
    }
  }
}
```

### Wrong Platform Name

```json
// Wrong
"platform_options": { "linkedin-page": { "author_urn": "urn:li:organization:123456" } }

// Correct
"platform_options": { "linkedin": { "author_urn": "urn:li:organization:123456" } }
```

### Invalid Settings for Platform

Examples:

- using `boardId` under `youtube`
- sending Pinterest without `boardId`
- sending TikTok photo posts with unsupported image types

## See Also

- [README.md](./README.md)
- [PROVIDER_SETTINGS_SUMMARY.md](./PROVIDER_SETTINGS_SUMMARY.md)
- [SKILL.md](./SKILL.md)
- `https://docs.mallary.ai/api-reference/endpoint/create#body-platform-options`
