---
name: mallary
description: Use when building social media publishing integrations, automating multi-platform content distribution, creating posts via API/CLI/MCP, scheduling content, uploading media, tracking job status, fetching analytics, or managing webhooks across X, Facebook, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Reddit, Threads, and Snapchat.
metadata:
  mintlify-proj: mallary
  version: "1.0"
---

# Mallary Skill Reference

## Product Summary

Mallary is a multi-platform social media publishing API, CLI, and MCP server for developers, operators, and AI agents. It provides a unified interface for uploading media, creating and scheduling posts, tracking publishing jobs, fetching analytics, and managing webhooks across 10 social platforms (X, Facebook, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Reddit, Threads, Snapchat) from a single integration.

**Key entry points:**

- REST API: `https://mallary.ai/api/v1/*` (Bearer token auth)
- CLI: `@mallary/cli` npm package (environment variable auth via `MALLARY_API_KEY`)
- MCP: `https://mallary.ai/mcp` (Bearer token auth)
- Dashboard: `https://mallary.ai` (web UI for account setup and no-code publishing)

**Core workflow:** Sign up → connect social accounts → get API key → upload media → create posts → track jobs → read analytics.

## When to Use

Reach for Mallary when:

- **Building integrations:** You need to add social media publishing to a SaaS product, internal tool, or backend system without maintaining separate per-platform integrations.
- **Automating content workflows:** You want to schedule posts, upload media, and track publishing status programmatically across multiple platforms in one request.
- **AI agent workflows:** You're building an agent that needs to publish content, check job status, or fetch analytics through MCP tools or CLI commands.
- **CI/CD pipelines:** You need to publish release announcements, deploy notifications, or marketing content as part of automated workflows.
- **Multi-platform publishing:** You want to post the same content to multiple platforms with platform-specific customizations (e.g., different post types, media rules, captions).
- **Analytics and webhooks:** You need to track publishing results, fetch engagement metrics, or react to publishing lifecycle events (scheduled, published, failed).

Do not use Mallary for: managing followers, moderating comments (except auto-reply), or accessing platform-specific features not exposed through the API.

## Quick Reference

### Authentication

All three interfaces use Bearer token authentication:

```bash
# CLI: environment variable
export MALLARY_API_KEY="your_api_key"

# API: HTTP header
Authorization: Bearer your_api_key

# MCP: HTTP header (same as API)
Authorization: Bearer your_api_key
```

### CLI Commands

| Task                | Command                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| Health check        | `mallary health`                                                                |
| Upload media        | `mallary upload ./image.png ./video.mp4`                                        |
| Create post         | `mallary posts create --message "text" --platform facebook --media ./file.mp4`  |
| List posts          | `mallary posts list --page 1 --per-page 25`                                     |
| Get job status      | `mallary jobs get {job_id}`                                                     |
| Delete post         | `mallary posts delete {post_id}`                                                |
| Fetch analytics     | `mallary analytics list` or `mallary analytics list --post-id {id}`             |
| List webhooks       | `mallary webhooks list`                                                         |
| Create webhook      | `mallary webhooks create --url https://example.com/hook --event post.published` |
| Delete webhook      | `mallary webhooks delete {webhook_id}`                                          |
| Get settings        | `mallary settings get`                                                          |
| Update settings     | `mallary settings update --file ./settings.json`                                |
| Disconnect platform | `mallary platforms disconnect facebook`                                         |

### API Endpoints

| Method | Endpoint                | Purpose                                      |
| ------ | ----------------------- | -------------------------------------------- |
| POST   | `/api/v1/upload`        | Get presigned upload URL and final media URL |
| POST   | `/api/v1/post`          | Create or schedule a post                    |
| GET    | `/api/v1/jobs/{id}`     | Get job status                               |
| GET    | `/api/v1/posts`         | List grouped posts                           |
| DELETE | `/api/v1/posts/{id}`    | Delete queued/scheduled post                 |
| GET    | `/api/v1/analytics`     | Fetch analytics snapshot                     |
| POST   | `/api/v1/disconnect`    | Disconnect a platform                        |
| GET    | `/api/v1/webhooks`      | List webhooks                                |
| POST   | `/api/v1/webhooks`      | Create webhook                               |
| DELETE | `/api/v1/webhooks/{id}` | Delete webhook                               |

### MCP Tools

| Tool                          | Purpose                  |
| ----------------------------- | ------------------------ |
| `mallary_create_upload_url`   | Get presigned upload URL |
| `mallary_create_post`         | Create or schedule post  |
| `mallary_get_job`             | Get job status           |
| `mallary_list_posts`          | List grouped posts       |
| `mallary_delete_post`         | Delete post              |
| `mallary_get_analytics`       | Fetch analytics          |
| `mallary_disconnect_platform` | Disconnect platform      |
| `mallary_list_webhooks`       | List webhooks            |
| `mallary_create_webhook`      | Create webhook           |
| `mallary_delete_webhook`      | Delete webhook           |

### Supported Platforms

X, Facebook, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Reddit, Threads, Snapchat. Use platform names: `x`, `facebook`, `instagram`, `linkedin`, `youtube`, `tiktok`, `pinterest`, `reddit`, `threads`, `snapchat`.

### Rate Limits (per user, per minute)

| Plan     | Requests/min |
| -------- | ------------ |
| Free     | 75           |
| Starter  | 150          |
| Pro      | 750          |
| Business | 1500         |

## Decision Guidance

### When to Use API vs CLI vs MCP

| Scenario                               | Use API | Use CLI | Use MCP |
| -------------------------------------- | ------- | ------- | ------- |
| Building a backend integration         | ✓       |         |         |
| Testing locally before API integration |         | ✓       |         |
| CI/CD pipeline automation              |         | ✓       |         |
| AI agent with tool access              |         |         | ✓       |
| SaaS product feature                   | ✓       |         |         |
| Shell script automation                |         | ✓       |         |
| LLM-based workflow                     |         |         | ✓       |

### When to Use Absolute vs Local Scheduling

| Scenario                                   | Use Absolute `scheduled_at` | Use Local `scheduled_at` + `scheduled_timezone` |
| ------------------------------------------ | --------------------------- | ----------------------------------------------- |
| You already know UTC time                  | ✓                           |                                                 |
| You want to schedule in user's timezone    |                             | ✓                                               |
| Scheduling from a backend with UTC context | ✓                           |                                                 |
| Scheduling from a user-facing form         |                             | ✓                                               |

**Example:**

```bash
# Absolute: 2026-04-06T18:30:00Z
mallary posts create --message "text" --platform facebook --scheduled-at "2026-04-06T18:30:00Z"

# Local: 2026-04-06T14:30 in America/New_York
mallary posts create --message "text" --platform facebook --scheduled-at "2026-04-06T14:30" --scheduled-timezone "America/New_York"
```

### When to Use Media Upload vs Direct URL

| Scenario                        | Use Upload Endpoint                 | Use Direct URL |
| ------------------------------- | ----------------------------------- | -------------- |
| Local file on disk              | ✓                                   |                |
| Generated image/video           | ✓                                   |                |
| Already hosted on Mallary CDN   |                                     | ✓              |
| Remote URL from another service | Upload first, then use returned URL |                |

## Workflow

### Typical Publishing Workflow

1. **Authenticate:** Set `MALLARY_API_KEY` (CLI) or prepare Bearer token (API/MCP).

2. **Upload media (if needed):**
   - CLI: `mallary upload ./image.png` → returns media URL
   - API: `POST /api/v1/upload` with filename and size → returns `mediaUrl`
   - MCP: `mallary_create_upload_url` → returns upload URL and media URL

3. **Create post:**
   - CLI: `mallary posts create --message "text" --platform facebook --media {mediaUrl}`
   - API: `POST /api/v1/post` with message, platforms array, media array
   - MCP: `mallary_create_post` with same payload

4. **Track job (optional):**
   - CLI: `mallary jobs get {jobId}`
   - API: `GET /api/v1/jobs/{jobId}`
   - MCP: `mallary_get_job` with job ID

5. **Fetch analytics (if plan supports):**
   - CLI: `mallary analytics list` or `mallary analytics list --post-id {postId}`
   - API: `GET /api/v1/analytics`
   - MCP: `mallary_get_analytics`

### Scheduling a Post

1. Determine target time: absolute UTC (`2026-04-06T18:30:00Z`) or local wall-clock time + timezone (`2026-04-06T14:30` + `America/New_York`).

2. Create post with `scheduled_at`:

   ```bash
   mallary posts create \
     --message "Scheduled post" \
     --platform facebook \
     --scheduled-at "2026-04-06T18:30:00Z"
   ```

3. Verify scheduling: `mallary posts list` shows post with scheduled status.

### Using Webhooks for Async Publishing

1. Create webhook: `mallary webhooks create --url https://example.com/hook --event post.published --event post.failed`

2. Include `webhook_url` in post creation (API only):

   ```json
   {
     "message": "text",
     "platforms": ["facebook"],
     "webhook_url": "https://example.com/callback"
   }
   ```

3. Receive webhook events at your endpoint when post lifecycle events occur.

## Common Gotchas

- **Missing API key:** CLI requires `MALLARY_API_KEY` environment variable. API and MCP require `Authorization: Bearer` header. Forgetting either causes 401 errors.

- **Plan-gated features:** Free plans have no scheduling, analytics, AI auto-reply, CLI, or MCP access. Requests for these features return plan-related errors. Upgrade to Starter or higher.

- **Platform-specific media rules are strict:** Each platform has different media requirements (e.g., YouTube requires exactly one video, Pinterest requires one image or GIF, TikTok video posts need one video, TikTok photo posts support up to 35 images). Violating these causes validation errors. Always check the platform-specific media rules before posting.

- **Local file uploads in CLI:** The CLI automatically uploads local files referenced in `--media`. Remote URLs are rejected unless already on Mallary CDN (`https://files.mallary.ai/...`). Use the upload endpoint first if you need to host media.

- **Scheduling timezone must be IANA format:** Use `America/New_York`, not `EST` or `Eastern`. Invalid timezone strings cause errors.

- **Idempotency key prevents duplicates:** If you're retrying requests, include `Idempotency-Key` header (API) or `--idempotency-key` flag (CLI) to prevent duplicate posts.

- **Comments under post not supported everywhere:** `comments_under_post` works on Threads but not TikTok. Check platform support before including.

- **TikTok defaults to MEDIA_UPLOAD, not DIRECT_POST:** By default, TikTok posts go to the creator inbox for review. Use `platform_options.tiktok.post_mode: "DIRECT_POST"` only if you want direct publishing without review.

- **Pinterest requires boardId:** Pinterest posts fail without `platform_options.pinterest.boardId`. Always include it.

- **Reddit requires subreddit:** Reddit posts fail without `platform_options.reddit.subreddit` or `subredditName`. Always include it.

- **Snapchat requires partner credentials:** Snapchat posting requires Snapchat Public Profile or Marketing API access plus Mallary server credentials. Posts fail fast without these.

- **JSON output in CLI:** Use `--json` flag for scripting. Without it, output is human-readable and not machine-parseable.

- **Exit codes matter in automation:** CLI returns 0 (success), 1 (local/config failure), or 2 (API/upload failure). Check exit codes in scripts.

## Verification Checklist

Before submitting work with Mallary:

- [ ] API key is set and valid (test with `mallary health` or `GET /api/v1/posts`)
- [ ] All target platforms are connected in the Mallary dashboard
- [ ] Media files meet platform-specific requirements (check platform-specific media rules)
- [ ] Scheduling time is in correct format (absolute UTC or local + IANA timezone)
- [ ] Platform-specific options are included where required (e.g., `boardId` for Pinterest, `subreddit` for Reddit)
- [ ] Webhook URL is reachable if using webhooks
- [ ] Plan supports the feature (scheduling, analytics, CLI, MCP, auto-reply)
- [ ] Rate limits are not exceeded (check plan limits)
- [ ] Idempotency key is included if retrying
- [ ] JSON output is valid if parsing CLI responses in scripts
- [ ] Test with one platform before multi-platform posts

## Resources

**Comprehensive navigation:** https://docs.mallary.ai/llms.txt

**Critical documentation pages:**

- [API Overview](https://docs.mallary.ai/api-reference/introduction) — authentication, base URL, core features, rate limits
- [Create Post Endpoint](https://docs.mallary.ai/api-reference/endpoint/create) — platform-specific media rules, scheduling, platform options
- [CLI Quickstart](https://docs.mallary.ai/cli-reference/quickstart) — basic commands to get started

---

> For additional documentation and navigation, see: https://docs.mallary.ai/llms.txt
