# Mallary CLI - Project Structure

## Overview

Mallary CLI is the official command-line interface for the public Mallary API. Developers, operators, and AI agents use it to automate media uploads, posts, scheduling, and analytics. They also use it for dashboard profile targeting, profile-scoped settings, connected platform lists, webhooks, and platform disconnects.

## Directory Structure

```text
cli/
├── src/                          # Source code
│   ├── index.ts                  # CLI entry point
│   ├── main.ts                   # Command parsing, request handling, rendering
│   └── version.ts                # Version export
│
├── dist/                         # Build output (generated)
│   ├── index.js                  # Executable entry
│   ├── main.js                   # Compiled command logic
│   └── version.js                # Compiled version module
│
├── test/                         # CLI tests
│   └── cli.test.ts               # Command and behavior tests
│
├── package.json                  # Package configuration
├── package-lock.json             # npm lockfile
├── tsconfig.json                 # TypeScript configuration
├── .gitignore                    # Git ignore rules
├── README.md                     # Main documentation
├── SKILL.md                      # AI agent usage guide
├── QUICK_START.md                # Quick start guide
├── PROFILES.md                   # Profile IDs, scoping, API endpoints, and limits
├── PROJECT_STRUCTURE.md          # This file
├── FEATURES.md                   # Feature summary
├── PROVIDER_SETTINGS.md          # Platform-specific posting fields
├── SUPPORTED_FILE_TYPES.md       # Upload behavior and file types
└── other supporting .md docs     # Additional usage, workflow, and publishing notes
```

## File Descriptions

### Source Files

#### `src/index.ts`

- executable entry point
- imports `runCli()` from `main.ts`
- exits with the returned CLI exit code

#### `src/main.ts`

- primary implementation file
- uses the built-in `parseArgs` module of Node
- validates CLI input
- resolves local media files
- uploads local files to Mallary
- sends authenticated requests to the Mallary API
- shows human output and JSON output

#### `src/version.ts`

- exports the CLI version for the help output and the version output

### Configuration Files

#### `package.json`

- package name: `@mallary/cli`
- executable bin: `mallary`
- scripts: `build`, `dev`, `start`, `test`
- metadata for npm publishing

#### `tsconfig.json`

- TypeScript compiler configuration
- outputs compiled files into `dist/`

### Documentation Files

#### `README.md`

- authoritative installation and usage documentation
- includes command examples, payload examples, and platform notes

#### `SKILL.md`

- condensed reference for AI agents and LLM-driven workflows

#### `QUICK_START.md`

- shortest path from install to first post

#### `PROFILES.md`

- explains profiles, public profile IDs, profile-scoped resources, and plan limits
- documents profile-aware CLI flags and API endpoints

#### `PROJECT_STRUCTURE.md`

- architecture overview
- file descriptions
- command flow and integration points

### Test Files

#### `test/cli.test.ts`

- validates command behavior
- checks input validation, upload handling, and API request shaping

## Build Process

### Development Build

```bash
cd cli
npm run build
```

- compiles TypeScript to ESM JavaScript
- writes output to `dist/`

### Production Build

```bash
cd cli
npm run build
```

Build characteristics:

1. compiles `src/index.ts`, `src/main.ts`, and `src/version.ts`
2. preserves the executable entry file
3. emits small, plain JS output rather than a bundled framework build

### Output

- `dist/index.js` - executable wrapper
- `dist/main.js` - main compiled CLI logic
- `dist/version.js` - version metadata

## Commands Architecture

### Command Flow

```text
User Input
    ↓
src/index.ts
    ↓
runCli() in src/main.ts
    ↓
Argument parsing / validation
    ↓
Optional local file upload handling
    ↓
Authenticated request to Mallary API
    ↓
Human output or --json output
```

### Available Commands

1. `health`
   - check Mallary service health
   - read-only command with the lowest risk. It does not require authentication

2. `upload <file...>`
   - create upload URLs
   - upload local files end-to-end
   - data-transmitting command. It sends local files to Mallary storage and to the Mallary CDN. Make sure that the file path and the file contents are correct before you run it

3. `posts create`
   - create or schedule posts
   - supports flag mode and file mode
   - publish side effect. It creates a real public or scheduled social-media post. Do not use it as a harmless test

4. `posts list`
   - list grouped posts
   - read-only command. The output can expose post metadata and profile context. Redact it before you share it

5. `posts delete <id>`
   - delete queued or scheduled posts
   - destructive command. It deletes a queued or scheduled Mallary post before the publish job starts. Make sure that the post ID, the profile, and the schedule are correct before you run it

6. `jobs get <id>`
   - inspect job status and result data
   - read-only command. The output can expose job, post, profile, platform, or provider result metadata

7. `jobs attach-tiktok-url <id> --url <url>`
   - attach a TikTok post URL for inbox-style TikTok publish flows
   - state-changing command. It records a public TikTok URL on a Mallary job. Make sure that the job ID and the URL are correct before you run it

8. `analytics list`
   - get analytics rows
   - read-only command. The output can expose account performance and platform metadata

9. `profiles list`
   - list profiles and their profile IDs
   - read-only command. The output exposes profile IDs and account structure. Minimize it and redact it

10. `webhooks list|create|delete`
   - manage webhook endpoints
   - data-transmitting and destructive commands. `create` sends future Mallary events to the external URL. `delete` stops the event delivery. Make sure that the destination URL, the events, and the webhook ID are correct before you run them

11. `settings get|update`
   - read or partially update profile-scoped settings
   - `settings update` is account-impacting. It can change the brand context and the AI auto-reply behavior. Make sure that the target profile and the JSON fields are correct before you run it

12. `platforms list`
   - list Mallary-supported platforms and show which are connected for a profile
   - read-only command. The output exposes connected-platform state and account labels. Minimize it and redact it

13. `platforms disconnect <platform>`
   - disconnect a connected social platform from a profile
   - destructive and account-impacting command. After the disconnect, Mallary cannot post, reply, or get analytics for that platform. Make sure that the platform and the profile are correct before you run it

## Environment Variables

| Variable | Required | Default | Usage |
| --- | --- | --- | --- |
| `MALLARY_API_KEY` | Yes | none | Authentication for all authenticated commands |

### Credential Handling

`MALLARY_API_KEY` is a bearer credential. It can authorize posts, uploads, webhook changes, settings updates, and account-management actions. Treat it as a secret.

- Store keys in a local secret manager, a locked-down untracked env file, or a CI secret store. Never commit them to source control.
- Avoid shell-history exposure: do not paste a real key into shared terminals, documentation, tickets, prompts, or screenshots.
- Do not print keys with `echo`, `printenv`, debug traces, request logs, or CI output. Redact all characters except the last few before you share logs.
- In CI, pass the key through masked secrets such as `secrets.MALLARY_API_KEY`. Disable shell tracing around Mallary commands. Restrict log access.
- If a key appears in logs, chat, shell history, or a committed file, rotate or revoke it before you continue.

## Dependencies

### Runtime Dependencies

- Node.js built-ins such as `fs/promises`, `path`, and `util`
- global `fetch` available in Node 18+

### Dev Dependencies

- `typescript`
- `tsx`
- `vitest`
- `@types/node`

## Integration Points

### With the Repository

1. built from the standalone `cli/` package
2. tested with `npm test`
3. published from `cli/package.json`

### With the Mallary API

1. `GET /health`
2. `POST /api/v1/upload`
3. `POST /api/v1/post`
4. `GET /api/v1/posts`
5. `DELETE /api/v1/posts/{id}`
6. `GET /api/v1/jobs/{id}`
7. `POST /api/v1/jobs/{id}/tiktok/post-url`
8. `GET /api/v1/analytics`
9. `GET/POST /api/v1/profiles`
10. `POST /api/v1/profiles/{id}`
11. `GET/POST/DELETE /api/v1/webhooks`
12. `GET/POST /api/v1/settings`
13. `GET /api/v1/platforms`
14. `POST /api/v1/disconnect`

Profile-aware endpoints accept a public `profile_id`. If you omit it, Mallary selects the default Dashboard profile.

Authentication:

- Bearer token using `MALLARY_API_KEY`
- CLI also sends `x-mallary-client: cli`

## Publishing

### To npm

```bash
cd cli
npm publish --access public
```

### Package Contents

- `dist/`
- `README.md`
- `SKILL.md`
- `PROFILES.md`

## Testing

### Manual Testing

```bash
# Build
cd cli && npm run build

# Test without an API key. Authenticated commands must fail
node dist/index.js posts list

# Test general help
node dist/index.js --help
```

### Automated Testing

```bash
cd cli
npm test
```

## Future Enhancements

- more command-specific help without authentication
- more platform-specific helper commands
- more structured JSON output for automation-heavy workflows
- more CLI-side checks for advanced `platform_options`

## Support

- Site: https://mallary.ai
- Docs: https://docs.mallary.ai
- Repository: https://github.com/mallarylabs/mallary-agent
- Support: support@mallary.ai
