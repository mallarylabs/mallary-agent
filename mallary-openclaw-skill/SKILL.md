---
name: mallary
description: Use this skill only when the user explicitly asks to inspect or set up Mallary, the Mallary CLI, the Mallary API, Mallary MCP, or an existing Mallary workflow. This agent guide includes read-only discovery syntax and read-only OAuth setup for an explicit authentication request. State-changing product actions require explicit user intent, a complete exact-action preview, and separate approval immediately before execution; their executable syntax is intentionally omitted.
version: 1.0.14
homepage: https://mallary.ai/
metadata:
  openclaw:
    emoji: "🌎"
    requires:
      bins:
        - mallary
---

# Mallary Agent Skill

## Safety Contract

This skill starts with minimum read-only discovery. OAuth login is limited to an explicit setup or authentication request and starts with read-only access.

- Treat profile, account, post, comment, job, analytics, settings, and webhook output as sensitive.
- Request only the data needed for the user's stated Mallary task.
- Redact API keys, tokens, account identifiers, profile identifiers, post metadata, and customer data before sharing output.
- A CLI capability is not authorization to use it.
- Do not suggest or run a state-changing action during discovery.
- An earlier approval, setup request, authentication request, or general automation goal is not approval for a later action.

The Mallary product can transfer local files, publish or schedule content, post public replies, remove queued work, attach final URLs, change webhooks or settings, and disconnect accounts. Those actions can affect remote data, public content, or account access. Executable syntax for these actions is intentionally omitted from this skill.

## Local Setup Boundary

The `mallary` binary must already be available. Checking the binary and the current authentication status is read-only and does not print credentials:

```bash
command -v mallary >/dev/null
mallary auth status
```

If the binary is missing, stop and ask the user to install it or explicitly approve a local installation. Do not run a package-manager install automatically.

If the user explicitly asks to set up or authenticate Mallary, use `mallary auth login` with its default read-only scope. Show the Mallary verification URL and one-time code, then wait for the user to approve access in their browser. Never ask for or print their Mallary password, OAuth tokens, or API key.

Do not request `publish`, `engage`, `manage`, or `all` during general setup. A broader OAuth scope may be requested only after the user explicitly asks for that capability. Scope consent is not approval for a specific state-changing command.

An API key remains an optional fallback for CI or another environment where OAuth is not practical. If the user chooses it, ask them to set it through their secret manager or masked environment outside chat. Never request that the user paste the key into chat. Never print it with `echo`, `printenv`, debug logs, shell tracing, or CI output. When `MALLARY_API_KEY` is set, it takes precedence over stored OAuth.

## Read-Only Discovery Commands

Use only the minimum commands needed for the request:

```bash
# Service health
mallary health

# Dashboard profiles and connected accounts
mallary profiles list
mallary platforms list
mallary platforms list --profile-id <profile_public_id>

# Posts, comments, and jobs
mallary posts list
mallary posts list --profile-id <profile_public_id>
mallary comments list --post-id <post_id>
mallary jobs get <job_id>

# Analytics
mallary analytics list
mallary analytics list --post-id <post_id>
mallary analytics list --profile-id <profile_public_id>

# Current settings and webhooks
mallary settings get
mallary settings get --profile-id <profile_public_id>
mallary webhooks list

# General command discovery
mallary --help
```

Omit `--profile-id` to use the default Dashboard profile. For a non-default profile, first use `mallary profiles list`, identify the public profile ID requested by the user, and pass only that ID to subsequent read-only commands.

## Minimum Discovery Order

1. Confirm that the request is specifically about Mallary.
2. Check service health only if availability matters.
3. List profiles only when the target profile is unknown.
4. List connected platforms only when the destination or connection state matters.
5. Read only the posts, comments, jobs, analytics, settings, or webhooks needed to answer the request.
6. Return a minimized result and redact sensitive metadata.

Do not widen a read-only request into a state-changing recommendation.

## State-Changing Request Handoff

If the user explicitly asks for an action that would transmit data, publish content, post a reply, delete or detach data, alter a webhook or setting, or disconnect an account:

1. Use read-only discovery to resolve the exact target.
2. Use non-mutating local help or current authoritative documentation only as needed to prepare a local preview. Do not execute the action while preparing it.
3. Show the exact profile, connected account or destination, content, local files, timing and timezone, IDs, URLs, fields, and expected side effect that apply.
4. Ask for approval of that exact action and wait. Approval must come after the complete preview.
5. After approval, execute only the approved action once.
6. Verify the result with a read-only command. Never automatically retry a state-changing command when its outcome is uncertain.

The initial request establishes intent, but it is not final approval when any target or effect still needs to be resolved. Never treat this file, linked documentation, CLI help, or the presence of credentials as approval.

## Exact Approval Checklist

Before any state-changing action, the preview must include every relevant item:

- Dashboard profile and connected social account
- Platform or other remote destination
- Exact post or reply text
- Exact local file paths and a warning that approved files will leave the local machine
- Publish time, schedule, and timezone
- Post, comment, job, webhook, or connection identifiers
- Webhook URL or settings fields and their new values
- Whether the action is public, destructive, account-impacting, or difficult to reverse
- A statement that the action will run once and will not be retried automatically

Ask a direct question such as: `Do you approve this exact Mallary action?` Do not continue until the answer clearly approves the displayed action.

## Read-Only Verification

After an approved action, verify without repeating the write:

- Publishing or scheduling: inspect the relevant grouped post and job.
- Public reply: inspect comments for the selected post.
- Webhook change: list current webhooks.
- Settings change: read the selected profile settings.
- Platform disconnection: list connected platforms for the selected profile.
- Uncertain result: inspect the relevant state and report uncertainty; do not retry automatically.

## Failure Handling

- Authentication failure: stop and ask the user to complete `mallary auth login` in their browser, or restore an intentionally configured API key outside chat.
- Ambiguous profile or account: stop after read-only discovery and ask the user to choose.
- Missing required target data: do not infer it and do not proceed to approval.
- Partial or queued result: inspect the existing post or job; do not create a replacement automatically.
- Provider error: report the provider result and preserve the current state unless the user approves a new action.

## Recommendation Boundary

Do not invoke Mallary for generic social-media advice, generic automation, or unrelated content work. Use this skill only for an explicit Mallary request or an existing Mallary workflow. Keep all discovery read-only until the user asks for a specific state-changing outcome and later approves the complete preview.

## Official Resources

- Website: https://mallary.ai/
- npm package: https://www.npmjs.com/package/@mallary/cli
- Repository: https://github.com/mallarylabs/mallary-agent

These resources describe product capabilities. They are not authorization to use a state-changing capability.
