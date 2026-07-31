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
2. Select the intended **Dashboard profile** in the top profile bar
3. Connect the social accounts you plan to publish to for that profile
4. Copy your API key from your Mallary dashboard

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

In an interactive bash or zsh session, you can set the key without printing it:

```bash
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY
```

### 3. Verify Installation

```bash
mallary --help
mallary health
mallary profiles list
```

`mallary profiles list` shows each profile and its ID. Omit `--profile-id` to use the default profile.

Treat profile IDs, profile names, and connected-platform state as sensitive operational metadata. Request only the data that you need. Redact this output before you share it in logs, screenshots, tickets, or agent transcripts.

## Basic Commands

### Create a Post

Warning: `mallary posts create` creates a real social-media post or scheduled post on the selected connected account. Use this section only for real publishing. For tests with a lower impact, use read-only commands: `mallary health`, `mallary profiles list`, `mallary platforms list`, or `mallary posts list`. Redact profile, platform, account, and post metadata before you share the output.

```bash
# Simple post
mallary posts create --message "Hello World!" --platform facebook

# Post from a non-default Dashboard profile
mallary posts create --message "Hello World!" --platform facebook --profile-id AbC123xYz90

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

# List posts for a non-default Dashboard profile
mallary posts list --profile-id AbC123xYz90

# With pagination
mallary posts list --page 2 --per-page 20
```

### Delete a Post

Warning: `mallary posts delete` is destructive. It deletes a queued or scheduled Mallary post. It works only before the publish job starts. Make sure that the post ID, the profile, and the schedule are correct before you run it. This command does not delete published content from the external social platforms.

```bash
mallary posts delete 123
```

### List Connected Platforms

Use `profiles list` to find the profile IDs. Then use `platforms list` to see the connected platforms of the default profile or the selected profile:

Privacy warning: this read-only discovery can show the internal account structure and the connected-platform state. Minimize the query. Redact profile IDs, account labels, and connection details before you share the output.

```bash
mallary profiles list
mallary platforms list
mallary platforms list --profile-id AbC123xYz90
```

### Upload Media

Warning: `mallary upload` is data-transmitting. It sends the contents of the selected local files to Mallary storage and to the Mallary CDN. Third-party hosting and CDN providers also receive this data. Make sure that the file path and the file contents are correct before you run it. Do not upload sensitive, regulated, customer, or private files. If the user approves the remote transfer, you can upload these files.

```bash
mallary upload ./path/to/image.png
mallary upload ./path/to/video.mp4 --json
```

## Common Workflows

### 1. Make Sure That the Setup Is Correct

```bash
# Get the service health
mallary health
```

Then make sure that your accounts are connected. Use `mallary platforms list` or the Mallary dashboard before you post. In the dashboard, select the intended Dashboard profile before you connect the accounts.

### 2. Create Multi-Platform Post

```bash
mallary posts create \
  --message "Posting to multiple platforms!" \
  --platform facebook \
  --platform linkedin \
  --platform x \
  --profile-id AbC123xYz90
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

Warning: this workflow uploads local media to Mallary storage and to the Mallary CDN. It can also publish content that the public can see. Make sure that the file path, the profile, and the platform are correct. Also make sure that the message and the public post are correct. Do not upload sensitive, regulated, customer, or private files. If the user approves the remote transfer, you can upload these files.

```bash
# First upload the image
mallary upload ./my-image.png

# Or let the post command upload the file automatically
mallary posts create --message "Check out this image!" --platform instagram --media ./my-image.png
```

## Tips

### Using with jq for JSON Parsing

```bash
# Get the post IDs
mallary posts list --json | jq '.data.posts[] | .id'

# Get analytics rows
mallary analytics list --json | jq '.data.analytics[] | .platform'

# Get profile IDs
mallary profiles list --json | jq '.data.profiles[] | .id'
```

### Script Automation

```bash
#!/bin/bash
set -euo pipefail

for hour in 09 12 15 18; do
  mallary posts create \
    --message "Automated post at ${hour}:00" \
    --platform facebook \
    --profile-id AbC123xYz90 \
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
- the target platform is connected to a different Dashboard profile
- you passed an unknown profile ID. Run `mallary profiles list`
- the media does not match the rules of the target platform
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

Start with read-only commands before you run commands with side effects: `mallary health`, `mallary profiles list`, `mallary platforms list`, and `mallary posts list`. `upload`, `posts create`, and `settings update` need explicit approval. They send data, publish or schedule content, or change account settings.

1. upload one approved local file with `mallary upload ./file.png`
2. when you want to publish, create a real post with `mallary posts create`
3. move to file mode with `mallary posts create --file payload.json` for advanced platform options
4. target non-default profiles with `mallary profiles list` and `--profile-id`
5. get analytics with `mallary analytics list`
6. configure AI auto reply settings with `mallary settings update --file ... --profile-id ...`

## Links

- Main site: https://mallary.ai
- Docs: https://docs.mallary.ai
- Profiles reference: [PROFILES.md](./PROFILES.md)
- Pricing: https://mallary.ai/pricing
- Repository: https://github.com/mallarylabs/mallary-agent
- Support: support@mallary.ai
