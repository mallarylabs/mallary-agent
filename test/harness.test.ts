import { describe, expect, it } from "vitest";

import { detectAgentHarness } from "../src/harness.js";

describe("AI agent harness detection", () => {
  it("detects OpenClaw runtime markers", () => {
    expect(detectAgentHarness({ OPENCLAW_SHELL: "exec" })).toEqual({
      name: "OpenClaw",
      version: null,
    });
  });

  it("detects Hermes without transmitting its session ID", () => {
    expect(detectAgentHarness({ AI_AGENT: "hermes-agent", HERMES_SESSION_ID: "private-session" })).toEqual({
      name: "Hermes",
      version: null,
    });
  });

  it("supports a generic explicit harness label", () => {
    expect(
      detectAgentHarness({ MALLARY_HARNESS: "custom-agent", MALLARY_HARNESS_VERSION: "1.2.3" })
    ).toEqual({ name: "custom-agent", version: "1.2.3" });
  });
});

