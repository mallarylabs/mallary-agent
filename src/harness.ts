export interface DetectedHarness {
  name: string;
  version: string | null;
}

function safeValue(value: unknown, maxLength = 80): string | null {
  const normalized = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength)
    .replace(/[^A-Za-z0-9 ._+\-]/g, "")
    .trim();
  return normalized || null;
}

function canonicalHarness(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("openclaw") || raw.includes("clawdbot") || raw.includes("moltbot")) {
    return "OpenClaw";
  }
  if (raw === "hermes" || raw.includes("hermes-agent") || raw.includes("hermes agent")) {
    return "Hermes";
  }
  if (raw.includes("claude")) return "Claude";
  if (raw.includes("chatgpt")) return "ChatGPT";
  if (raw.includes("codex")) return "Codex";
  return safeValue(value);
}

export function detectAgentHarness(env: NodeJS.ProcessEnv): DetectedHarness | null {
  const explicit = canonicalHarness(env.MALLARY_HARNESS);
  if (explicit) {
    return {
      name: explicit,
      version: safeValue(env.MALLARY_HARNESS_VERSION, 40),
    };
  }

  const aiAgent = canonicalHarness(env.AI_AGENT);
  if (aiAgent) return { name: aiAgent, version: null };

  if (env.HERMES_SESSION_ID) return { name: "Hermes", version: null };
  if (env.OPENCLAW_SHELL || env.OPENCLAW_CLI) return { name: "OpenClaw", version: null };
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return { name: "Claude", version: null };
  if (env.CODEX_SANDBOX || env.CODEX_THREAD_ID) return { name: "Codex", version: null };
  return null;
}

