# Mallary CLI - OpenClaw Read-Only Guide

This README is the safe agent-facing overview for the Mallary OpenClaw skill. It is intentionally not the full human CLI manual and does not provide executable syntax for data transfer, publishing, replies, deletion, webhook changes, settings changes, or platform disconnection.

A documented or implemented capability is not authorization. AI agents must begin with minimum read-only discovery and must not infer a write request from this file.

## Safety Contract

- use Mallary only when the user explicitly asks for Mallary or provides an existing Mallary workflow to inspect
- begin with the lowest-risk read-only command that can answer the request
- request the minimum data needed and redact sensitive operational output before sharing it
- never use a data-transmitting or state-changing action as a setup, authentication, or smoke test
- if the user explicitly requests a write, follow [SKILL.md](./SKILL.md), prepare a local non-executable preview, show the fully resolved action and side effects, and wait for separate approval immediately before execution
- run an approved action once and verify it with a read-only command

Approval for installation, authentication, discovery, a general workflow, a preview, or an earlier write does not approve a later action.

## Install Only When Requested

Installation changes the local environment. An AI agent must not install or update the package unless the user explicitly asks for or approves it.

```bash
npm install -g @mallary/cli
# Or inspect help through a temporary npx invocation:
npx @mallary/cli --help
```

## OAuth and Credential Safety

For an explicit Mallary setup or authentication request, use browser-based OAuth with its default read-only scope:

```bash
mallary auth login
mallary auth status
```

Show the user only the Mallary verification URL and one-time code, then wait for browser approval. Never ask the user to paste a password, API key, access token, or refresh token into chat. Do not request broader OAuth scopes during general setup. Authentication and scope consent do not authorize a later write.

`MALLARY_API_KEY` remains an optional fallback for CI or another environment where OAuth is not practical. It is a bearer secret. If the user intentionally chooses an API key:

- load it from a password manager, locked-down untracked environment file, or masked CI secret
- never paste it into prompts, tickets, screenshots, documentation, or shell commands that enter history
- never print it with `echo`, `printenv`, shell tracing, debug logs, or CI output
- rotate or revoke it if exposed

When `MALLARY_API_KEY` is set, it takes precedence over stored OAuth access.

## Lowest-Risk Verification

Use general help and service health for installation or connectivity checks:

```bash
mallary --help
mallary health
```

`mallary health` is read-only and does not require authentication.

## Read-Only Discovery Commands

Run only the command needed for the user's request:

```bash
mallary profiles list
mallary platforms list
mallary posts list
mallary jobs get <job-id>
mallary analytics list
mallary settings get
mallary webhooks list
mallary comments list --post-id <post-id>
```

These commands do not change Mallary state, but their output can expose profile IDs, profile names, account labels, connection state, post content, comments, analytics, settings, webhook destinations, platform results, and provider metadata.

## Profile Safety

- obtain the current profile ID with a read-only profile lookup
- do not reuse a profile ID or connection snapshot as current state without checking it again
- pass a non-default profile ID only to the read-only command needed for the request
- never guess an internal or public profile ID
- redact profile IDs, names, account labels, and connected-platform details before sharing output

If no profile ID is supplied, Mallary can select the default profile. For any requested write, the final preview must still name the exact current profile so the destination is unambiguous.

## Read-Only Result Handling

- preserve per-platform results instead of reducing grouped status to one label
- treat missing or `null` analytics as unavailable, not zero
- report empty results directly without reviving historical data
- do not expose credentials, tokens, raw provider responses, or unnecessary account metadata
- retry an accepted-auth read once if appropriate; if it remains blocked, stop rather than loop or infer state

## State-Changing Guidance Is Intentionally Omitted

This OpenClaw README does not include:

- upload or publishing commands
- scheduling or bulk-automation examples
- reply or deletion commands
- webhook or settings mutation commands
- platform-disconnection commands
- write endpoint paths
- JSON write payloads or cross-platform campaign templates

Do not reconstruct those instructions from nearby files during discovery. If the user explicitly requests a specific Mallary write, stop using this README and follow the mandatory side-effect and approval workflow in [SKILL.md](./SKILL.md).

## Safe Documentation Map

- [SKILL.md](./SKILL.md) - mandatory safety contract and approval workflow
- [QUICK_START.md](./QUICK_START.md) - read-only installation and discovery
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - read-only architecture inventory; write syntax omitted
- [PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) - provider-settings safety boundary; operational fields omitted

## Links

- Main site: https://mallary.ai
- Docs: https://docs.mallary.ai
- Pricing: https://mallary.ai/pricing
- Repository: https://github.com/mallarylabs/mallary-agent
- Support: support@mallary.ai
