# Mallary CLI - Feature Summary

## Complete Feature Set

Mallary CLI is the official command-line interface for Mallary.ai. Its read-only commands let developers, operators, CI jobs, and AI agents inspect jobs, analytics, settings, profiles, webhooks, and connected platforms. It also has write-capable commands for uploads, publishing, replies, webhook changes, settings updates, post deletion, TikTok URL attachment, and platform disconnection. Those capabilities do not give an AI agent permission to use them.

The CLI mirrors the public Mallary API. It does not bypass plan limits, feature gates, connected-account requirements, or platform validation rules.

## AI Agent Safety Contract

This feature list describes what the CLI can do. It is not permission to suggest or run a state-changing command.

- Start with the minimum read-only discovery needed for the request. Prefer `mallary health`, `mallary profiles list`, `mallary platforms list`, `mallary posts list`, `mallary jobs get`, `mallary analytics list`, `mallary settings get`, or `mallary webhooks list`.
- Treat discovery output as sensitive. Request only needed fields and redact profile IDs, account labels, post data, settings, and webhook details before sharing them.
- Before suggesting or running an upload, post, reply, delete, TikTok URL attachment, webhook change, settings update, or platform disconnect, explain the side effect and show the exact profile, destination, content, file, URL, ID, timing, or fields that will change.
- Wait for the user to explicitly approve that exact action. Approval for installation, authentication, discovery, an earlier command, or a general workflow does not approve a later write.
- Run only the approved action once. Then use a read-only command to verify the result. Never use a write command as a smoke test.

For unattended CI, the owner must pre-approve the exact command, profile, destinations, payload source, and intended side effect in that workflow. Do not broaden that authorization at runtime.

### Posts with Comments and Media - FULLY SUPPORTED

Mallary supports both simple post creation and advanced payload-based publishing.

#### Posts with Comments

- You can attach follow-up comments with repeatable `--comment` flags in flag mode.
- In file mode, use `comments_under_post` in the JSON payload.
- The public API currently limits follow-up comments to 3 items.

#### Multiple Media per Post/Comment

- Mallary supports multi-media posts where the target platform allows it.
- The CLI uploads local file paths before it sends the post request.
- The CLI also uploads local video thumbnail paths in `media[].thumbnail_url`.
- The CLI rejects remote third-party media URLs.
- The CLI accepts `https://files.mallary.ai/...` URLs.

#### Multi-Platform Posting

- One `posts create` request can target multiple platforms at once.
- Use repeatable `--platform` flags in flag mode.
- Use the `platforms` array in file mode.
- In file mode, `platform_options` changes the platform-specific behavior.

#### Advanced Features

- Automatic local file upload before post creation
- Absolute or timezone-aware scheduling
- Idempotency keys
- Optional per-post AI auto reply flag
- Job inspection
- Analytics fetching
- Dashboard profile listing and `--profile-id` targeting
- Webhook management
- Profile-scoped settings read/update
- Profile-scoped connected platform listing and disconnect
- TikTok post URL attachment for inbox-style TikTok workflows

#### Profiles

Profiles group your social media accounts. You can create one profile for each of your businesses. Then connect the social media accounts of each business inside its profile. If you do not send a `profile_id` with a request, Mallary uses your default profile.

- Every user has a default profile.
- Omit `--profile-id` or `profile_id` to use the default profile.
- Use `mallary profiles list` to find your profile IDs.
- Pass `--profile-id` to target a non-default profile in `posts create`, `posts list`, `analytics list`, `settings get/update`, `platforms list`, and `platforms disconnect`.
- In JSON file mode, send `profile_id`.
- Platform connections, posts, analytics, and AI auto-reply settings are profile-scoped.
- The CLI lists profiles and targets them. The dashboard and the REST API create and rename profiles.
- Commands that create posts, upload files, update settings, manage webhooks, or disconnect platforms have side effects. Make sure that the target profile and the result you want are correct before you run them.

## Publishing Payload Formats (Approval-Gated Reference)

Mallary supports two main ways to create content.

This section documents payload shapes. It does not recommend that an AI agent create or publish content. During read-only discovery, do not assemble a publishing command from this section.

Only after the user explicitly asks for a publishing proposal may an agent prepare a local preview. Preparing a preview does not authorize publishing. Show the fully resolved profile, platforms, text, media, comments, schedule, and platform settings, then wait for separate approval before running any write command.

### 1. Simple Flag Payload

This shape represents a small, user-requested publishing preview with shared fields such as a message, platforms, media, and follow-up comments. Consult `mallary posts create --help` only after the user asks for this proposal. Do not run the create command while preparing or reviewing the preview.

### 2. File Payload

A local JSON preview can represent an action that the user explicitly asked to review. Do not pass the file to `posts create` until the user approves the exact resolved payload.

File payloads can represent:

- `platform_options`
- a reusable payload for human review
- reviewed optional fields that do not fit the smaller flag preview

## Local Payload Preview Examples (Do Not Execute)

These JSON objects demonstrate data shape only. They are not publishing requests and must not be converted into executable commands during discovery. Replace every placeholder, show the complete resolved action to the user, and obtain separate approval before any upload, scheduling, or publishing action.

### Example 1: Message with Follow-up Comments

```json
{
  "message": "<reviewed message>",
  "platforms": ["facebook", "linkedin", "x"],
  "media": [{ "url": "<reviewed local media path>" }],
  "comments_under_post": [
    { "content": "<reviewed follow-up comment 1>" },
    { "content": "<reviewed follow-up comment 2>" }
  ]
}
```

### Example 2: Follow-up Array Shape

```json
{
  "message": "<reviewed thread message>",
  "platforms": ["x"],
  "media": [{ "url": "<reviewed local media path>" }],
  "comments_under_post": [
    { "content": "<reviewed thread reply 1>" },
    { "content": "<reviewed thread reply 2>" },
    { "content": "<reviewed thread reply 3>" }
  ]
}
```

### Example 3: Platform Options Shape

```json
{
  "profile_id": "<reviewed profile ID>",
  "message": "<reviewed message>",
  "platforms": ["facebook", "instagram", "youtube", "pinterest"],
  "media": [{ "url": "<reviewed local media path>" }],
  "scheduled_at": "<reviewed local date and time>",
  "scheduled_timezone": "<reviewed IANA timezone>",
  "platform_options": {
    "facebook": {
      "post_type": "feed"
    },
    "instagram": {
      "post_type": "reel"
    },
    "youtube": {
      "post_type": "shorts",
      "title": "<reviewed title>",
      "visibility": "public"
    },
    "pinterest": {
      "post_type": "video",
      "boardId": "<reviewed board ID>"
    }
  }
}
```

## API Structure Reference

Mallary CLI sends the post to the Mallary API: `POST /api/v1/post`.

### Complete Create Payload Shape

```ts
type CreatePostPayload = {
  profile_id?: string;
  message: string;
  platforms: string[];
	  media?: Array<{
	    url: string;
	    thumbnail_url?: string;
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

## AI Agent Restrictions

AI agents use read-only commands by default. Uploading, publishing, replying, deleting, attaching a TikTok URL, changing webhooks or settings, and disconnecting platforms are approval-gated.

### Default Behavior: Read Only

- stay in read-only discovery unless the user explicitly asks for a publishing proposal
- do not infer publishing intent from a request to inspect profiles, platforms, posts, settings, jobs, or analytics
- after a user requests a proposal, prepare only a local preview and do not upload media or submit it
- show the exact resolved action and wait for separate approval immediately before execution

### Local Preview Boundary

- an explicit request for a publishing proposal authorizes only a local, non-executable preview
- include the proposed profile, destinations, text, media paths, comments, timing, and settings in that preview
- do not select or recommend a CLI creation mode during discovery
- do not upload files, create a post, or schedule content while preparing the preview
- require separate approval of the fully resolved action immediately before execution

### Additional Restrictions

- do not suggest or run a write-capable command until the user explicitly approves the exact action
- prefer `--json` output for read-only machine handling
- call `mallary profiles list --json` before targeting a non-default profile
- a user-requested preview may use local JSON, but it must not be submitted before separate approval
- treat local uploads as a remote data transfer to Mallary storage. Confirm and receive approval for the exact files before uploading
- never pass third-party remote media URLs directly to the CLI
- free plans do not include CLI access

## Files and Documentation

- `README.md` - read-only OpenClaw agent overview; write syntax omitted
- `SKILL.md` - compact agent-facing reference
- `QUICK_START.md` - read-only onboarding and verification
- `PROFILES.md` - profile model, public IDs, commands, API endpoints, and limits
- `PROVIDER_SETTINGS.md` - provider-settings agent safety boundary; operational fields and syntax omitted
- `SUPPORTED_FILE_TYPES.md` - read-only media format and platform-limit notes

## Summary

Read-only commands can inspect jobs, posts, analytics, settings, webhooks, profiles, and connected platforms. The following capabilities are approval-gated for AI agents:

- upload local media to Mallary storage and to the Mallary CDN
- create direct or scheduled posts on connected social accounts
- add follow-up comments to posts
- manage webhooks that send Mallary events to external URLs
- manage profile-scoped brand settings that affect account behavior
- disconnect platforms from a profile
