# Mallary CLI - Project Structure

## Overview

Mallary CLI is the official command-line interface for the public Mallary API. It is designed for developers, operators, and AI agents that need to automate media uploads, posting, scheduling, analytics, settings, webhooks, and platform disconnects.

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
├── llms.txt                      # Compact AI-agent command summary
│
├── README.md                     # Main documentation
├── SKILL.md                      # AI agent usage guide
├── QUICK_START.md                # Quick start guide
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
- uses Node’s built-in `parseArgs`
- validates CLI input
- resolves local media files
- uploads local files to Mallary
- sends authenticated requests to the Mallary API
- renders human output and JSON output

#### `src/version.ts`

- exports the CLI version used in help/version output

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

2. `upload <file...>`
   - create upload URLs
   - upload local files end-to-end

3. `posts create`
   - create or schedule posts
   - supports flag mode and file mode

4. `posts list`
   - list grouped posts

5. `posts delete <id>`
   - delete queued or scheduled posts

6. `jobs get <id>`
   - inspect job status and result data

7. `jobs attach-tiktok-url <id> --url <url>`
   - attach a TikTok post URL for inbox-style TikTok publish flows

8. `analytics list`
   - fetch analytics rows

9. `webhooks list|create|delete`
   - manage webhook endpoints

10. `settings get|update`
   - read or partially update account settings

11. `platforms disconnect <platform>`
   - disconnect a connected social platform

## Environment Variables

| Variable | Required | Default | Usage |
| --- | --- | --- | --- |
| `MALLARY_API_KEY` | Yes | none | Authentication for all authenticated commands |

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
9. `GET/POST/DELETE /api/v1/webhooks`
10. `GET/POST /api/v1/settings`
11. `POST /api/v1/disconnect`

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
- `llms.txt`

## Testing

### Manual Testing

```bash
# Build
cd cli && npm run build

# Test without API key (should fail for authenticated commands)
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

- richer command-specific help without requiring auth
- additional platform-specific helper commands where they make sense
- more structured JSON output for automation-heavy workflows
- broader CLI-side validation for advanced `platform_options`

## Support

- Site: https://mallary.ai
- Docs: https://docs.mallary.ai
- Repository: https://github.com/mallarylabs/mallary-agent
- Support: support@mallary.ai
