# Supported File Types for Upload

Mallary CLI reads the upload MIME type from the file extension. It uploads the selected local files to Mallary storage and to the Mallary CDN before it publishes the post. This step is not local-only. The upload command sends the file bytes to Mallary infrastructure, and local media paths in posting commands do the same. The media can then become externally hosted at a Mallary file URL.

The public upload path is for image and video media. Audio, documents, and other binary files are not part of the public publishing flow.

Warning: `mallary upload` is data-transmitting. It sends the contents of the selected local files to Mallary storage and to the Mallary CDN. Third-party hosting and CDN providers also receive this data. Make sure that the file paths and the file contents are correct before you run the upload examples. This also applies to scripts and to AI-agent workflows. Do not upload sensitive, regulated, customer, or private files. If the user approves the remote transfer, you can upload these files.

## How It Works

The CLI gets the content type from the local filename:

```bash
mallary upload video.mp4
# Detected as: video/mp4

mallary upload image.png
# Detected as: image/png

mallary upload clip.webm
# Detected as: video/webm
```

## Supported File Types

### Images

| Extension       | MIME Type    | Supported |
| --------------- | ------------ | --------- |
| `.png`          | `image/png`  | Yes       |
| `.jpg`, `.jpeg` | `image/jpeg` | Yes       |
| `.webp`         | `image/webp` | Yes       |
| `.gif`          | `image/gif`  | Yes       |
| `.bmp`          | `image/bmp`  | Yes       |

Examples:

```bash
mallary upload photo.jpg
mallary upload logo.png
mallary upload animation.gif
mallary upload cover.webp
```

### Videos

| Extension       | MIME Type          | Supported |
| --------------- | ------------------ | --------- |
| `.mp4`          | `video/mp4`        | Yes       |
| `.mov`          | `video/quicktime`  | Yes       |
| `.webm`         | `video/webm`       | Yes       |
| `.mkv`          | `video/x-matroska` | Yes       |
| `.avi`          | `video/x-msvideo`  | Yes       |
| `.mpeg`, `.mpg` | `video/mpeg`       | Yes       |

Examples:

```bash
mallary upload video.mp4
mallary upload clip.mov
mallary upload recording.webm
mallary upload demo.mkv
```

### Audio

| Extension | MIME Type                  | Supported |
| --------- | -------------------------- | --------- |
| `.mp3`    | `application/octet-stream` | No        |
| `.wav`    | `application/octet-stream` | No        |
| `.ogg`    | `application/octet-stream` | No        |
| `.m4a`    | `application/octet-stream` | No        |

Notes:

- the public Mallary upload flow is for social media image assets and video assets
- audio-only uploads are not part of the public CLI workflow

### Documents

| Extension | MIME Type                  | Supported |
| --------- | -------------------------- | --------- |
| `.pdf`    | `application/octet-stream` | No        |
| `.doc`    | `application/octet-stream` | No        |
| `.docx`   | `application/octet-stream` | No        |

If you need a document-style asset, convert it into an image or video format. The destination platform must support that format.

### Other Files

For unknown extensions, the CLI falls back to:

- MIME type: `application/octet-stream`
- Result: not suitable for the public Mallary upload flow

## Usage Examples

### Upload an Image

```bash
mallary upload ./images/photo.jpg --json
```

Response:

```json
{
  "ok": true,
  "uploads": [
    {
      "source_path": "./images/photo.jpg",
      "filename": "photo.jpg",
      "media_url": "https://files.mallary.ai/uploads/photo.jpg",
      "storage_key": "uploads/photo.jpg",
      "content_type": "image/jpeg",
      "size": 12345
    }
  ]
}
```

### Upload a Video (MP4)

```bash
mallary upload ./videos/promo.mp4 --json
```

Response:

```json
{
  "ok": true,
  "uploads": [
    {
      "source_path": "./videos/promo.mp4",
      "filename": "promo.mp4",
      "media_url": "https://files.mallary.ai/uploads/promo.mp4",
      "storage_key": "uploads/promo.mp4",
      "content_type": "video/mp4",
      "size": 9876543
    }
  ]
}
```

### Upload and Use in Post

Warning: this workflow uploads local media to Mallary storage and to the Mallary CDN. It then publishes or schedules real content on the selected connected social-media account. First, make sure that the file, the profile, the platform, the message, and the result you want are correct. Do not upload sensitive, regulated, customer, or private files. If the user approves the remote transfer, you can upload these files.

```bash
# 1. Upload the file
RESULT=$(mallary upload video.mp4 --json)

# 2. Extract the media URL
MEDIA_URL=$(echo "$RESULT" | jq -r '.uploads[0].media_url')

# 3. Use it in a post
mallary posts create \
  --message "Check out our latest demo." \
  --platform youtube \
  --profile-id AbC123xYz90 \
  --media "$MEDIA_URL"
```

Omit `--profile-id` to use the default Dashboard profile. Use `mallary profiles list` to find public profile IDs for non-default profiles.

### Upload Multiple Files

```bash
# Upload images
mallary upload image1.jpg image2.png image3.gif

# Upload videos
mallary upload video1.mp4 video2.mov
```

## Platform-Specific Notes

### TikTok

- video posts require exactly one video
- photo posts support up to 35 `jpg`, `jpeg`, or `webp` images
- `png` images are not accepted for TikTok photo posts

### YouTube

- requires exactly one video
- `post_type` can be `regular` or `shorts`
- custom thumbnails for regular videos can use `jpg`, `jpeg`, or `png` up to 2 MB. Use `1280x720` and the 16:9 ratio
- Mallary skips YouTube Shorts thumbnails

### Instagram

- choose `feed`, `story`, `reel`, or `carousel` through `platform_options.instagram.post_type`
- stories use exactly one image or one video. They do not support captions or follow-up comments
- reels use exactly one video
- carousels use 2 to 10 image or video items
- use `media[].thumbnail_url` for video covers and Reels covers

### Facebook

- video thumbnails can use `jpg`, `jpeg`, or `png` up to 10 MB through `media[].thumbnail_url`

### X (Twitter)

- supports up to 4 images, or 1 video, or 1 GIF

### LinkedIn

- current public path supports text-only posts or one image attachment

## Troubleshooting

### "Upload failed: Unsupported file type"

The public Mallary uploader does not support this image or video format.

Solution: convert it first.

```bash
# Convert a video to MP4
ffmpeg -i input.avi output.mp4

# Then upload
mallary upload output.mp4
```

### File Size Limits

The Mallary upload path accepts files up to 5 GB. Each social platform also applies its own limits after the upload.

### "MIME type mismatch"

Do not rename a file to a different extension to force a MIME type.

```bash
# Wrong: PNG renamed to JPG
launch.jpg

# Correct: keep the real extension
launch.png
```

## Testing File Upload

```bash
# Confirm API key is set without printing it
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"

# Test image upload
mallary upload test-image.jpg

# Test video upload
mallary upload test-video.mp4

# Unsupported example
mallary upload test-audio.mp3
```

## Error Messages

### File Not Found

Look at the local path:

```bash
mallary upload ./missing-file.jpg
```

### No Permission

Make sure that your current user can read the file.

### Invalid API Key

Set a valid Mallary API key:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
mallary upload test-image.jpg
```

## Summary

- Mallary CLI supports image and video uploads for the public social publishing workflow.
- The Mallary CDN hosts the uploaded media at `https://files.mallary.ai/...`.
- Audio, documents, and unknown binary types are not normal public upload targets.
- Always read the platform media rules before you send the same asset to more than one destination.
