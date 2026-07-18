# Mallary CLI - Quick Start Guide

## Installation

### From npm

```bash
# Install globally
npm install -g @mallary/cli

# Or with npx
npx @mallary/cli --help
```

## Setup

### 1. Get Your API Key

1. Sign in to your Mallary account at https://mallary.ai
2. Connect the social accounts you plan to publish to
3. Copy your API key from your Mallary dashboard

### 2. Set Environment Variable

Security: `MALLARY_API_KEY` is a bearer secret. Do not commit it, paste it into prompts or tickets, print it in logs, or expose it in shell history. Use your password manager, a locked-down untracked env file, or a CI secret store for persistent use.

```bash
# Bash/Zsh, without printing the key
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY

# Fish, without printing the key
read --silent --prompt-str "Mallary API key: " MALLARY_API_KEY; set -gx MALLARY_API_KEY $MALLARY_API_KEY

# PowerShell, without typing the key into command history
$secureKey = Read-Host "Mallary API key" -AsSecureString
$env:MALLARY_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey))
```

For an interactive bash/zsh session, you can avoid printing the key while setting it:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
```

### 3. Verify Installation

```bash
mallary --help
mallary health
```

## Basic Commands

### Create a Post

```bash
# Simple post
mallary posts create --message "Hello World!" --platform facebook

# Post with multiple images
mallary posts create \
  --message "Check these out!" \
  --platform x \
  --media ./img1.jpg \
  --media ./img2.jpg

# Post a video with a custom thumbnail
mallary posts create \
  --message "Product walkthrough" \
  --platform youtube \
  --media ./video.mp4 \
  --thumbnail ./cover.jpg

# Post with follow-up comments
mallary posts create \
  --message "Main post" \
  --platform facebook \
  --comment "First follow-up comment" \
  --comment "Second follow-up comment"

# Scheduled post
mallary posts create \
  --message "Future post" \
  --platform linkedin \
  --scheduled-at "2026-12-31T12:00:00Z"
```

### List Posts

```bash
# List all posts
mallary posts list

# With pagination
mallary posts list --page 2 --per-page 20
```

### Delete a Post

Warning: `mallary posts delete` is destructive. It permanently removes a queued or scheduled Mallary post/job that has not started publishing. Confirm the exact post ID, profile, schedule, and intended cancellation before running it. This command does not remove content that is already published on external social platforms.

```bash
mallary posts delete 123
```

### Check Connected Platforms

Use `platforms list` to see which supported Mallary platforms are currently connected for your authenticated account:

```bash
mallary platforms list
```

### Upload Media

```bash
mallary upload ./path/to/image.png
mallary upload ./path/to/video.mp4 --json
```

## Common Workflows

### 1. Check Your Setup

```bash
# Verify the service is healthy
mallary health
```

Then confirm your connected accounts with `mallary platforms list` or in the Mallary dashboard before posting.

### 2. Create Multi-Platform Post

```bash
mallary posts create \
  --message "Posting to multiple platforms!" \
  --platform facebook \
  --platform linkedin \
  --platform x
```

### 3. Schedule Multiple Posts

```bash
# Morning post
mallary posts create --message "Good morning!" --platform facebook --scheduled-at "2026-04-20T09:00:00Z"

# Afternoon post
mallary posts create --message "Lunch time update!" --platform facebook --scheduled-at "2026-04-20T12:00:00Z"

# Evening post
mallary posts create --message "Good night!" --platform facebook --scheduled-at "2026-04-20T20:00:00Z"
```

### 4. Upload and Post Image

```bash
# First upload the image
mallary upload ./my-image.png

# Or let the post command upload the file automatically
mallary posts create --message "Check out this image!" --platform instagram --media ./my-image.png
```

## Tips & Tricks

### Using with jq for JSON Parsing

```bash
# Get just the post IDs
mallary posts list --json | jq '.data.posts[] | .id'

# Get analytics rows
mallary analytics list --json | jq '.data.analytics[] | .platform'
```

### Script Automation

```bash
#!/bin/bash
set -euo pipefail

for hour in 09 12 15 18; do
  mallary posts create \
    --message "Automated post at ${hour}:00" \
    --platform facebook \
    --scheduled-at "2026-04-20T${hour}:00:00Z"
  echo "Created post for ${hour}:00"
done
```

### Environment Variables

```bash
# Required for authenticated commands
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"

# The public CLI uses the fixed production base URL:
# https://mallary.ai
```

## Troubleshooting

### API Key Not Set

If you see a `missing_api_key` error:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
test -n "${MALLARY_API_KEY:-}" && echo "MALLARY_API_KEY is set"
```

### Command Not Found

If `mallary` is not available after linking or install:

```bash
which mallary

# Re-link if needed
cd cli
npm link
```

### API Errors

Common causes:

- your API key is invalid
- your plan does not include CLI access
- the target platform is not connected
- the media does not meet the target platform’s rules
- you passed an external remote media URL instead of a Mallary-hosted one

## Getting Help

```bash
# General help
mallary --help

# Command-specific help
node cli/dist/index.js help posts create
node cli/dist/index.js help upload
node cli/dist/index.js help analytics list
```

## Next Steps

1. try `mallary upload ./file.png`
2. create a simple post with `mallary posts create`
3. move to file mode with `mallary posts create --file payload.json` for advanced platform options
4. fetch analytics with `mallary analytics list`
5. configure AI auto reply settings with `mallary settings update --file ...`

## Links

- Main site: https://mallary.ai
- Docs: https://docs.mallary.ai
- Pricing: https://mallary.ai/pricing
- Repository: https://github.com/mallarylabs/mallary-agent
- Support: support@mallary.ai
