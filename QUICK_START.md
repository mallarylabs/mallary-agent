# Mallary CLI - Read-Only Quick Start

This guide is the safe default for humans, CI jobs, and AI agents. It intentionally stops before uploads, publishing, replies, deletion, webhook changes, settings updates, or platform disconnection. A documented capability is not permission to use it.

If the user explicitly requests a state-changing Mallary action, stop using this quick start and follow the mandatory approval workflow in [SKILL.md](./SKILL.md).

## 1. Install Only When Requested

Installing a package changes the local environment. An AI agent must not install Mallary unless the user explicitly asks for or approves the installation.

```bash
npm install -g @mallary/cli
# Or inspect help without a global install:
npx @mallary/cli --help
```

## 2. Sign In with Read-Only OAuth

If the user explicitly asked for Mallary setup or authentication, start browser-based OAuth with the default read-only scope:

```bash
mallary auth login
mallary auth status
```

Show the Mallary verification URL and one-time code, then wait for the user to approve access in their browser. Never ask them to paste a password, OAuth token, or API key into chat. Do not request a broader OAuth scope during general setup. Authentication does not authorize uploads or account changes.

`MALLARY_API_KEY` remains an optional fallback for CI or another environment where OAuth is not practical. If the user chooses it, load it from a masked secret store, never print it, and never paste it into a prompt. When set, it takes precedence over stored OAuth.

## 3. Verify with the Lowest-Risk Commands

Start with general help and service health:

```bash
mallary --help
mallary health
```

`mallary health` is read-only and does not require authentication. Do not use a write command as an installation or authentication test.

## 4. Use Only the Minimum Read-Only Discovery Needed

The following commands do not change Mallary state, but their output can expose profile IDs, account labels, post content, settings, webhook destinations, and provider metadata. Run only the command needed for the user's request and redact sensitive output before sharing it.

```bash
mallary profiles list
mallary platforms list
mallary posts list
mallary jobs get <job-id>
mallary analytics list
mallary settings get
mallary webhooks list
```

For a non-default profile, first obtain its current public ID with `mallary profiles list`, then pass that ID only to the read-only command needed for the request. Never reuse a profile ID or account snapshot as current state without checking it again.

## 5. Stop Before Data Transfer or State Changes

This guide intentionally omits executable syntax for data-transmitting, publishing, destructive, and account-impacting commands. Do not infer or construct that syntax from other documentation during read-only discovery.

If the user explicitly asks for one of those actions:

1. use minimum read-only discovery to resolve the current profile and destination
2. prepare a local, non-executable preview without uploading files or changing Mallary
3. show the exact profile, destinations, content, local files, timing, URL, IDs, fields, and side effects
4. wait for explicit approval of that fully resolved action immediately before execution
5. run the approved action once
6. verify the result with a read-only command

Approval for installation, authentication, discovery, a general workflow, or an earlier write does not approve a later action.

## Troubleshooting

### Authentication Required

If a read-only authenticated command returns `authentication_required`, run `mallary auth status`. If the user explicitly asked to authenticate, start `mallary auth login` and wait for browser approval. For an intentionally configured API key, restore it through the secret manager without printing it.

### Command Not Found

Check whether the command is available without changing the installation:

```bash
command -v mallary
```

If it is not installed, ask for approval before installing or linking it.

### Read-Only API Errors

Common causes include:

- the OAuth connection expired or was revoked, or an API key is invalid
- the plan does not include the requested CLI feature
- the requested profile ID is unknown or stale
- the requested resource does not exist

Do not test an error by uploading a file, creating content, or changing account state.

## Next Step

Remain in read-only mode unless the user explicitly requests a specific Mallary write. For any requested write, read and follow [SKILL.md](./SKILL.md), especially the command side-effect classification and mandatory approval workflow.

## Links

- Main site: https://mallary.ai
- Docs: https://docs.mallary.ai
- Pricing: https://mallary.ai/pricing
- Repository: https://github.com/mallarylabs/mallary-agent
