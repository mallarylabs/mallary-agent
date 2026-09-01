import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readCliDoc(relativePath: string): string {
  return readFileSync(path.join(cliDir, relativePath), "utf8");
}

function commentSection(source: string, heading: string, nextHeading: string): string {
  const start = source.indexOf(heading);
  if (start < 0) return "";
  const next = source.indexOf(nextHeading, start + heading.length);
  return source.slice(start, next < 0 ? source.length : next);
}

describe("CLI agent documentation safety", () => {
  const agentReadmeDocs = ["mallary-openclaw-skill/README.md"];
  const featureDocs = ["FEATURES.md", "mallary-openclaw-skill/FEATURES.md"];
  const projectDocs = ["PROJECT_STRUCTURE.md", "mallary-openclaw-skill/PROJECT_STRUCTURE.md"];
  const providerDocs = [
    "PROVIDER_SETTINGS.md",
    "mallary-openclaw-skill/PROVIDER_SETTINGS.md",
    "mallary-openclaw-skill/PROVIDER_SETTINGS_SUMMARY.md",
  ];
  const quickStartDocs = ["QUICK_START.md", "mallary-openclaw-skill/QUICK_START.md"];
  const supportedFileTypeDocs = [
    "SUPPORTED_FILE_TYPES.md",
    "mallary-openclaw-skill/SUPPORTED_FILE_TYPES.md",
  ];
  const skillDocs = ["SKILL.md", "mallary-openclaw-skill/SKILL.md"];

  for (const relativePath of agentReadmeDocs) {
    it(`${relativePath} advertises read-only discovery rather than write capabilities`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("# Mallary CLI - OpenClaw Safety Guide");
      expect(source).toContain("## Read-Only Discovery Commands");
      expect(source).toContain("## State-Changing Guidance Is Intentionally Omitted");
      expect(source).toContain("execute without asking for another confirmation");
      expect(source).toContain("Do not ask the user to choose scopes or add scope flags.");
      expect(source).not.toContain("--scope");
      expect(source).not.toContain("With the CLI you can:");
      expect(source).not.toContain("## AI Agent Notes");
      expect(source).not.toContain(
        "If you are an AI agent, or if you build an agent integration"
      );
      expect(source).not.toContain(
        "read [PROFILES.md](./PROFILES.md) before targeting a non-default Dashboard profile"
      );
      expect(source).not.toContain("if the CLI is part of an automated toolchain");
      expect(source).not.toContain(
        "prefer `mallary posts create --file payload.json` for complex platform-specific payloads"
      );
      expect(source).not.toContain("upload local media files to Mallary.ai");
      expect(source).not.toContain("create and schedule posts to your social media accounts");
      expect(source).not.toContain("manage profile-scoped brand and AI auto-reply settings");
      expect(source).not.toContain("disconnect platforms from a profile");
      expect(source).not.toContain("mallary posts create");
      expect(source).not.toContain("mallary upload");
      expect(source).not.toContain("mallary posts delete");
      expect(source).not.toContain("mallary comments reply");
      expect(source).not.toContain("mallary webhooks create");
      expect(source).not.toContain("mallary webhooks delete");
      expect(source).not.toContain("mallary settings update");
      expect(source).not.toContain("mallary platforms disconnect");
    });
  }

  for (const relativePath of featureDocs) {
    it(`${relativePath} distinguishes capabilities from authorization`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("## AI Agent Safety Contract");
      expect(source).toContain("It is not a user request to run a state-changing command.");
      expect(source).toContain("A clear request to publish, schedule, upload media for that post, or send a reply authorizes that action.");
      expect(source).toContain("do not ask for a second confirmation");
      expect(source).toContain("Never use a write command as a smoke test.");
      expect(source).toContain("## Publishing Payload Formats (Explicit-Request Reference)");
      expect(source).toContain("If the user asks only for a proposal or preview, prepare it locally and do not publish.");
      expect(source).toContain("## Local Payload Preview Examples (Do Not Execute)");
      expect(source).toContain("## AI Agent Restrictions");
      expect(source).toContain("### Default Behavior: Read Only");
      expect(source).toContain("### Local Preview Boundary");
      expect(source).toContain("do not select or recommend a CLI creation mode during discovery");
      expect(source).not.toContain("With the CLI they upload media, create posts");
      expect(source).not.toContain("Mallary CLI supports agents and automation.");
      expect(source).not.toContain("### When to Use Simple Mode");
      expect(source).not.toContain("### When to Use Advanced Mode (JSON)");
      expect(source).not.toContain("the agent composes a small, standard post");
      expect(source).not.toContain("the CLI must upload the local files automatically");
      expect(source).not.toContain("the workflow is shell-first");
      expect(source).not.toContain("human review of the exact CLI command is useful");
      expect(source).not.toContain("the agent needs `platform_options`");
      expect(source).not.toContain("the post spans multiple platforms with different rules");
      expect(source).not.toContain("### Choosing a Payload Shape for a Requested Preview");
      expect(source).not.toContain("### AI Agent Tips");
      expect(source).not.toContain("Advanced mode is best when:");
      expect(source).not.toContain("an AI agent assembles a complex request");
      expect(source).not.toContain("an AI agent is assembling a complex request");
      expect(source).not.toContain(
        "you mix scheduling, media, comments, and platform-specific settings"
      );
      expect(source).not.toContain(
        "you are mixing scheduling, media, comments, and platform-specific settings"
      );
      expect(source).not.toContain(
        "scheduling, media, comments, and platform-specific settings"
      );
      expect(source).not.toContain("mallary posts create --file complex-post.json");
    });
  }

  for (const relativePath of providerDocs) {
    it(`${relativePath} is a safety boundary and omits the publishing playbook`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("Operational provider schemas and publishing syntax are intentionally omitted");
      expect(source).toContain("read-only discovery");
      expect(source).toContain("A clear request to publish authorizes that post without a second confirmation.");
      expect(source).toContain("mallary profiles list");
      expect(source).toContain("mallary platforms list");
      expect(source).not.toContain("mallary posts create");
      expect(source).not.toContain("--file payload.json");
      expect(source).not.toContain("--file post-with-settings.json");
      expect(source).not.toContain("```json");
      expect(source).not.toContain("platform_options");
      expect(source).not.toContain("post_type");
      expect(source).not.toContain("boardId");
      expect(source).not.toContain("privacy_level");
      expect(source).not.toContain("## Local Preview Shape");
      expect(source).not.toContain("## Platform Field Reference");
      expect(source).not.toContain("### Reddit");
      expect(source).not.toContain("### YouTube");
      expect(source).not.toContain("Run it with:");
      expect(source).not.toContain("### Method 1: Command Line");
      expect(source).not.toContain("Use flags for shared fields:");
      expect(source).not.toContain('--message "Content"');
      expect(source).not.toContain("publishes or schedules real content");
      expect(source).not.toContain("The main workflow is");
    });
  }

  for (const relativePath of quickStartDocs) {
    it(`${relativePath} remains read-only and omits executable write syntax`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("# Mallary CLI - Safe Setup Quick Start");
      expect(source).toContain("This guide is the safe default for humans, CI jobs, and AI agents.");
      expect(source).toContain("## 4. Use Only the Minimum Read-Only Discovery Needed");
      expect(source).toContain("## 5. Stop Before Data Transfer or State Changes");
      expect(source).toContain("This guide intentionally omits executable syntax");
      expect(source).toContain("execute the requested action once without asking for another confirmation");
      expect(source).toContain("## Next Step");
      expect(source).toContain("Remain in read-only mode unless the user explicitly requests");
      expect(source).not.toContain("--scope");
      expect(source).not.toContain("shortest path from install to first post");
      expect(source).not.toContain("## Next Steps");
      expect(source).not.toContain(
        "Start with read-only commands before you run commands with side effects"
      );
      expect(source).not.toContain("upload one approved local file");
      expect(source).not.toContain("when you want to publish, create a real post");
      expect(source).not.toContain("move to file mode with");
      expect(source).not.toContain("configure AI auto reply settings with");
      expect(source).not.toContain("### Create a Post");
      expect(source).not.toContain("Use this section only for real publishing");
      expect(source).not.toContain('mallary posts create --message "Hello World!"');
      expect(source).not.toContain("Post from a non-default Dashboard profile");
      expect(source).not.toContain("# Post with multiple images");
      expect(source).not.toContain("### Delete a Post");
      expect(source).not.toContain("mallary posts delete 123");
      expect(source).not.toContain("It works only before the publish job starts");
      expect(source).not.toContain(
        "This command does not delete published content from the external social platforms"
      );
      expect(source).not.toContain(
        "Make sure that the post ID, the profile, and the schedule are correct"
      );
      expect(source).not.toContain("### Upload Media");
      expect(source).not.toContain("mallary upload ./path/to/image.png");
      expect(source).not.toContain("mallary upload ./path/to/video.mp4 --json");
      expect(source).not.toContain("Third-party hosting and CDN providers also receive this data");
      expect(source).not.toContain(
        "If the user approves the remote transfer, you can upload these files"
      );
      expect(source).not.toContain("### Script Automation");
      expect(source).not.toContain("for hour in 09 12 15 18");
      expect(source).not.toContain('Automated post at ${hour}:00');
      expect(source).not.toContain('Created post for ${hour}:00');
      expect(source).not.toContain('--scheduled-at "2026-04-20T${hour}:00:00Z"');
      expect(source).not.toContain("mallary posts create");
      expect(source).not.toContain("mallary posts delete");
      expect(source).not.toContain("mallary upload");
      expect(source).not.toContain("mallary settings update");
    });
  }

  for (const relativePath of supportedFileTypeDocs) {
    it(`${relativePath} documents formats without executable transfer or publishing workflows`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("# Supported Media Formats (Read-Only Reference)");
      expect(source).toContain("## Agent Safety Boundary");
      expect(source).toContain(
        "Executable upload and publishing syntax is intentionally omitted"
      );
      expect(source).toContain("Ask only when one of those material details is missing or ambiguous. Do not ask for a second confirmation");
      expect(source).toContain("## Supported Image Formats");
      expect(source).toContain("## Supported Video Formats");
      expect(source).toContain("## Platform-Specific Media Notes");
      expect(source).toContain("## Read-Only Troubleshooting");
      expect(source).toContain("## Explicit Request Handoff");
      expect(source).not.toContain("# Supported File Types for Upload");
      expect(source).not.toContain(
        "Mallary CLI reads the upload MIME type from the file extension"
      );
      expect(source).not.toContain(
        "It uploads the selected local files to Mallary storage and to the Mallary CDN before it publishes the post"
      );
      expect(source).not.toContain("before you run the upload examples");
      expect(source).not.toContain(
        "This also applies to scripts and to AI-agent workflows"
      );
      expect(source).not.toContain("## How It Works");
      expect(source).not.toContain(
        "The CLI gets the content type from the local filename"
      );
      expect(source).not.toContain("### Upload and Use in Post");
      expect(source).not.toContain("## Usage Examples");
      expect(source).not.toContain("## Testing File Upload");
      expect(source).not.toContain("mallary upload");
      expect(source).not.toContain("mallary posts create");
      expect(source).not.toContain("RESULT=$(mallary upload video.mp4 --json)");
      expect(source).not.toContain('MEDIA_URL=$(echo "$RESULT"');
      expect(source).not.toContain("# 3. Use it in a post");
      expect(source).not.toContain(
        "If the user approves the remote transfer, you can upload these files"
      );
    });
  }

  for (const relativePath of projectDocs) {
    it(`${relativePath} treats architecture as inventory rather than authorization`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("## Agent Safety Boundary");
      expect(source).toContain("This architecture guide starts with read-only inspection paths.");
      expect(source).toContain("an implemented code path is not authorization to suggest or use it");
      expect(source).toContain("This file is an architecture inventory, not a workflow recommendation.");
      expect(source).toContain("never treat a listed command, endpoint, or code path as permission");
      expect(source).toContain("treat a clear request to publish, schedule, upload media for that post, or send a reply as authorization for that action");
      expect(source).toContain("### Read-Only Discovery Commands");
      expect(source).toContain("### Explicit-Request Code Paths (Syntax Intentionally Omitted)");
      expect(source).toContain("Their executable CLI syntax is intentionally omitted");
      expect(source).toContain("Explicit-request write endpoint paths are intentionally omitted");
      expect(source).not.toContain("--scope");

      const readOnlyInventory = commentSection(
        source,
        "### Read-Only Discovery Commands",
        "### Explicit-Request Code Paths"
      );
      expect(readOnlyInventory).toContain("`posts list`");
      expect(readOnlyInventory).toContain("`webhooks list`");
      expect(readOnlyInventory).not.toContain("`upload <file...>`");
      expect(readOnlyInventory).not.toContain("`posts create`");
      expect(readOnlyInventory).not.toContain("`posts delete <id>`");
      expect(readOnlyInventory).not.toContain("attach-tiktok-url");
      expect(readOnlyInventory).not.toContain("platforms disconnect");
      expect(source).not.toContain("### Available Commands");
      expect(source).not.toContain(
        "data-transmitting command. It sends local files to Mallary storage"
      );
      expect(source).not.toContain(
        "publish side effect. It creates a real public or scheduled social-media post"
      );
      expect(source).not.toContain("`POST /api/v1/post`");
      expect(source).not.toContain("`DELETE /api/v1/posts/{id}`");
      expect(source).not.toContain(
        "Developers, operators, and AI agents use it to automate media uploads, posts, scheduling, and analytics."
      );
      expect(source).not.toContain(
        "It is designed for developers, operators, and AI agents that need to automate media uploads"
      );
      expect(source).not.toContain("shortest path from install to first post");
    });
  }

  for (const relativePath of skillDocs) {
    it(`${relativePath} exposes only read-only executable syntax`, () => {
      const source = readCliDoc(relativePath);
      expect(source).toContain("version: 1.0.18");
      expect(source).toContain("one-step OAuth setup with full Mallary access");
      expect(source).toContain("mallary auth login");
      expect(source).toContain("Do not ask the user to choose OAuth scopes or add scope flags.");
      expect(source).toContain("## Explicit Action Requests");
      expect(source).toContain("## Publishing Request Boundary");
      expect(source).toContain("Do not turn a clear publishing request into a preview-and-confirm loop.");
      expect(source).not.toContain("--scope");
      expect(source).not.toContain("env:\n        - MALLARY_API_KEY");
      expect(source).toContain("## Read-Only Discovery Commands");
      expect(source).toContain("Executable syntax for these actions is intentionally omitted");
      expect(source).toContain("Never automatically retry a state-changing command");
      expect(source).toContain("mallary profiles list");
      expect(source).toContain("mallary platforms list");
      expect(source).toContain("mallary posts list");
      expect(source).toContain("mallary comments list");
      expect(source).toContain("mallary jobs get");
      expect(source).toContain("mallary analytics list");
      expect(source).toContain("mallary settings get");
      expect(source).toContain("mallary webhooks list");

      const discoveryIndex = source.indexOf("1. Use read-only discovery");
      const clarifyIndex = source.indexOf("3. If a material detail");
      const executeIndex = source.indexOf("4. For publishing");
      const verifyIndex = source.indexOf("6. Verify the result");
      expect(discoveryIndex).toBeGreaterThan(-1);
      expect(clarifyIndex).toBeGreaterThan(discoveryIndex);
      expect(executeIndex).toBeGreaterThan(clarifyIndex);
      expect(verifyIndex).toBeGreaterThan(executeIndex);

      expect(source).not.toContain("version: 1.0.2");
      expect(source).not.toContain("## Install Mallary if it is not installed");
      expect(source).not.toContain("npm install -g @mallary/cli");
      expect(source).not.toContain("Bash(mallary\\*)");
      expect(source).not.toContain("## Common Patterns");
      expect(source).not.toContain("## Platform-Specific Examples");
      expect(source).not.toContain("## Quick Reference");
      expect(source).not.toContain("mallary posts create");
      expect(source).not.toContain("mallary upload");
      expect(source).not.toContain("mallary comments reply");
      expect(source).not.toContain("mallary posts delete");
      expect(source).not.toContain("mallary jobs attach-tiktok-url");
      expect(source).not.toContain("mallary webhooks create");
      expect(source).not.toContain("mallary webhooks delete");
      expect(source).not.toContain("mallary settings update");
      expect(source).not.toContain("mallary platforms disconnect");
      expect(source).not.toContain("Social media publishing CLI for multi-platform posting and automation");
    });
  }
});
