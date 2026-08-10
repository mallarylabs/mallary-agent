# Provider Settings - Agent Safety Boundary

## Purpose

This document defines the safety boundary for provider-specific settings. It is not a field reference or publishing playbook.

Operational provider schemas and publishing syntax are intentionally omitted. Do not infer a payload, media workflow, destination setting, or executable command from this file.

## Default Behavior: Read Only

An AI agent must remain in read-only discovery unless the user explicitly requests a specific Mallary publishing proposal. General questions about supported platforms, account status, or provider behavior do not authorize drafting or executing a post.

Use only the read-only command needed to resolve current state:

```bash
mallary profiles list
mallary platforms list --profile-id <current-profile-id>
```

Profile IDs, profile names, account labels, and connection state are sensitive. Minimize and redact the output. Never reuse an older profile ID or connection snapshot as current state without checking it again.

## If the User Explicitly Requests a Provider-Specific Proposal

An explicit request permits preparation of a local, non-executable preview only. It does not approve publishing.

1. resolve the current profile and connected destinations with minimum read-only discovery
2. gather the user's desired content, destination, media, timing, privacy, disclosure, and platform-specific choices without uploading or changing Mallary
3. consult authoritative Mallary product documentation only as needed to validate that local preview
4. present the fully resolved profile, destinations, content, local files, timing, provider choices, and side effects without an executable command
5. wait for separate explicit approval immediately before execution
6. run the approved action once and verify it with a read-only command

Do not guess a destination-specific choice. If a required choice is missing, stop and ask for it rather than selecting a default.

## Approval Does Not Carry Forward

Approval for installation, authentication, discovery, a general workflow, a local preview, or an earlier write does not approve a later action. A new destination, file, message, schedule, or setting requires a new fully resolved preview and approval.

## Intentionally Omitted

To prevent this agent-facing document from becoming an actionable publishing guide, it does not include:

- publishing or upload commands
- JSON request bodies or payload templates
- provider field names or accepted values
- media upload or thumbnail workflows
- scheduling examples
- cross-platform campaign examples
- destructive or account-management commands

For a user-requested write, follow the command side-effect classification and mandatory approval workflow in [SKILL.md](./SKILL.md). Do not use another document to bypass this boundary.

## Review Checklist

Before any requested write, confirm that:

- the current profile and every destination were verified read-only
- the user supplied or approved all destination-specific choices
- every local file and URL was identified and reviewed
- message, media, timing, privacy, disclosure, and side effects are explicit
- the user approved this exact action immediately before execution
- the action will run once and be verified read-only

If any item is missing, remain read-only.
