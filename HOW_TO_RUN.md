# How to Run the Mallary CLI

There are several ways to run the CLI, depending on your needs.

## Option 1: Direct Execution (Quick Test)

The built file at `cli/dist/index.js` is executable.

```bash
# From the repository root
node cli/dist/index.js --help

# Or run it directly (it has a shebang)
./cli/dist/index.js --help

# Example authenticated command; complete OAuth login first
node cli/dist/index.js auth login
node cli/dist/index.js posts list
```

## Option 2: Link Globally (Recommended for Development)

This creates a global `mallary` command you can use anywhere.

```bash
# From the CLI directory
cd cli
npm link

# Now you can use it anywhere
mallary --help
mallary profiles list
mallary posts list
mallary platforms list

# To unlink later
npm unlink -g @mallary/cli
```

After linking, you can use `mallary` from any directory.

## Option 3: Use npm Scripts (From `cli/`)

```bash
# From the CLI directory
cd cli
npm run build
npm run start -- --help
npm run start -- profiles list
npm run start -- posts list
npm run start -- platforms list
```

## Option 4: Use npm/npx (Published Package)

Once published or installed from npm:

```bash
# Install globally
npm install -g @mallary/cli

# Or use with npx (no global install)
npx @mallary/cli --help
npx @mallary/cli posts list
```

## Quick Setup Guide

### Step 1: Build the CLI

```bash
# From the repository root
cd cli
npm install
npm run build
```

### Step 2: Sign In with OAuth

OAuth is the default for interactive use. It opens a browser-based one-time-code flow and stores the resulting credentials outside the project directory.

```bash
mallary auth login
mallary auth status
```

OAuth grants read, publish, engage, and manage access in one sign-in. Users do not choose scopes or sign in again for another Mallary feature. `MALLARY_API_KEY` remains an optional fallback for CI and other non-interactive environments. When set, it takes precedence over OAuth.

### Step 3: Choose Your Method

For quick testing:

```bash
node cli/dist/index.js --help
```

For regular use:

```bash
cd cli
npm link
mallary --help
```

## Troubleshooting

### "Command not found: mallary"

If you linked globally but still get this error:

```bash
# Check if it's linked
which mallary

# If not found, try linking again
cd cli
npm link

# Or check your PATH
echo $PATH
```

### "Authentication required"

```bash
mallary auth status
mallary auth login
```

If you intentionally use an API key instead, restore it through a secret manager or masked environment without printing it.

### Permission Denied

If you get permission errors when you run the built file directly:

```bash
# Make the file executable
chmod +x cli/dist/index.js

# Then try again
./cli/dist/index.js --help
```

### Rebuild After Changes

After making code changes, rebuild:

```bash
cd cli
npm run build
```

If you linked globally, your changes will be reflected after the rebuild.

## Testing the CLI

### Test Help Command

```bash
mallary --help
node cli/dist/index.js help posts create
```

### Test with Safe Read-Only Commands (requires OAuth or an API key)

```bash
mallary auth status

# Health check
mallary health

# List connected platforms
mallary platforms list
```

### Optional Real Publish Check

Warning: `mallary posts create` publishes or schedules content through Mallary to the selected connected social-media account. Do not run this as a harmless test. Use it only when the current task clearly calls for a real public or scheduled post and the profile, platform, and message/media are known.

```bash
# Publishes a real Facebook post to the selected profile
mallary posts create \
  --message "Intentional publish from Mallary CLI" \
  --platform facebook
```

## Development Workflow

### 1. Make Changes

Edit files in `cli/src/`.

### 2. Rebuild

```bash
cd cli
npm run build
```

### 3. Test

```bash
# If linked globally
mallary --help

# Or direct execution
node cli/dist/index.js --help
```

### 4. Run Tests

```bash
cd cli
npm test
```

## Environment Variables

### Optional

- `MALLARY_API_KEY` - an API-key override for CI or another environment where OAuth is not practical

Treat `MALLARY_API_KEY` as a bearer credential. Store it in a secret manager, a locked-down untracked env file, or a masked CI secret. Do not commit it, paste it into prompts or tickets, print it with `echo`/`printenv`, enable shell tracing around it, or share logs that contain it. If the key is exposed, rotate or revoke it.

### Setting the Optional API Key

Temporary:

```bash
# For bash/zsh, without printing the key
read -rsp "Mallary API key: " MALLARY_API_KEY; echo; export MALLARY_API_KEY

# For fish, without printing the key
read --silent --prompt-str "Mallary API key: " MALLARY_API_KEY; set -gx MALLARY_API_KEY $MALLARY_API_KEY

# For PowerShell
$env:MALLARY_API_KEY="your_key"
```

Persistent local storage:

Use a password manager, shell secret plugin, OS keychain, or untracked env file with restrictive permissions. Do not write real keys directly into shared dotfiles. Do not write them into commands that the shell can save in its history.

## Using Aliases

If you want a shorter command:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias my='mallary'

# Now you can use
my posts list
```

## Production Deployment

### Install from npm

```bash
# Global install
npm install -g @mallary/cli

# Project-specific or one-off use
npx @mallary/cli --help
```

## Summary of Methods

| Method                | Command                      | Best For               |
| --------------------- | ---------------------------- | ---------------------- |
| Direct node execution | `node cli/dist/index.js ...` | Quick local testing    |
| Direct executable     | `./cli/dist/index.js ...`    | Quick local testing    |
| npm link              | `mallary ...`                | Day-to-day development |
| npm scripts           | `npm run start -- ...`       | Working inside `cli/`  |
| npm global install    | `mallary ...`                | Published usage        |
| npx                   | `npx @mallary/cli ...`       | One-off usage          |

## Recommended Setup

```bash
# 1. Build
cd cli && npm install && npm run build

# 2. Link globally
npm link

# 3. Sign in with OAuth
mallary auth login
mallary auth status

# 4. Test
mallary health

# 5. Start with read-only commands
mallary profiles list
mallary posts list
```

Do not include `mallary posts create` in setup smoke tests. It performs an external publish or schedule action on a connected social-media account. Use the optional real publish check above only when the current task clearly calls for a public or scheduled post and the target profile, platform, and message/media are known.
