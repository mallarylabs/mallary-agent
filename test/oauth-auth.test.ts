import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/main.js";
import { saveOAuthCredentials, type OAuthCredentials } from "../src/oauth.js";

class MemoryWriter {
  chunks: string[] = [];

  write(chunk: string) {
    this.chunks.push(String(chunk));
  }

  toString() {
    return this.chunks.join("");
  }
}

const tempDirs: string[] = [];
const NOW = Date.parse("2026-08-10T12:00:00.000Z");

afterEach(async () => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

async function credentialFile(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "mallary-cli-oauth-"));
  tempDirs.push(directory);
  return path.join(directory, "config", "credentials.json");
}

function credentials(overrides: Partial<OAuthCredentials> = {}): OAuthCredentials {
  return {
    version: 1,
    access_token: "oauth-access-secret",
    refresh_token: "oauth-refresh-secret",
    token_type: "Bearer",
    scopes: ["openid", "offline_access", "mallary.read"],
    expires_at: NOW + 3_600_000,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Mallary CLI OAuth", () => {
  it("completes device login without printing OAuth tokens", async () => {
    const filePath = await credentialFile();
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const requests: Array<{ url: string; body: string }> = [];
    let tokenPolls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, body: String(init?.body || "") });
      if (url === "https://auth.mallary.ai/device/auth") {
        return jsonResponse({
          device_code: "private-device-code",
          user_code: "ABCD-EFGH",
          verification_uri: "https://auth.mallary.ai/device",
          verification_uri_complete: "https://auth.mallary.ai/device?user_code=ABCD-EFGH",
          expires_in: 600,
          interval: 5,
        });
      }
      if (url === "https://auth.mallary.ai/token") {
        tokenPolls += 1;
        if (tokenPolls === 1) {
          return jsonResponse({ error: "authorization_pending" }, 400);
        }
        return jsonResponse({
          access_token: "private-access-token",
          refresh_token: "private-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      return jsonResponse({ error: "not_found" }, 404);
    };

    const code = await runCli(["auth", "login", "--json"], {
      stdout,
      stderr,
      env: {},
      fetch: fetchImpl,
      now: () => NOW,
      sleep: async () => undefined,
      oauthCredentialPath: () => filePath,
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout.toString())).toEqual({
      authenticated: true,
      method: "oauth",
      scopes: ["mallary.read"],
      expires_at: "2026-08-10T13:00:00.000Z",
      storage: "local_credentials_file",
      api_key_override: false,
    });
    expect(stderr.toString()).toContain("ABCD-EFGH");
    expect(`${stdout.toString()}${stderr.toString()}`).not.toContain("private-device-code");
    expect(`${stdout.toString()}${stderr.toString()}`).not.toContain("private-access-token");
    expect(`${stdout.toString()}${stderr.toString()}`).not.toContain("private-refresh-token");
    expect(requests[0].body).toContain("scope=openid+offline_access+mallary.read");
    expect(requests[1].body).toContain("device_code=private-device-code");
    expect(requests[2].body).toContain("device_code=private-device-code");

    const stored = JSON.parse(await readFile(filePath, "utf8"));
    expect(stored.access_token).toBe("private-access-token");
    expect(stored.refresh_token).toBe("private-refresh-token");
    if (process.platform !== "win32") {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
  });

  it("reports a safe unauthenticated status without failing", async () => {
    const filePath = await credentialFile();
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    expect(await runCli(["auth", "status", "--json"], {
      stdout,
      stderr,
      env: {},
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    expect(JSON.parse(stdout.toString())).toEqual({ authenticated: false, method: null });
    expect(stderr.toString()).toBe("");
  });

  it("uses stored OAuth for API requests and keeps auth status token-free", async () => {
    const filePath = await credentialFile();
    await saveOAuthCredentials(filePath, credentials());
    const authorizationHeaders: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      authorizationHeaders.push(new Headers(init?.headers).get("authorization") || "");
      return jsonResponse({ status: "ok", data: { posts: [] } });
    };

    const postsOut = new MemoryWriter();
    expect(await runCli(["posts", "list", "--json"], {
      stdout: postsOut,
      stderr: new MemoryWriter(),
      env: {},
      fetch: fetchImpl,
      now: () => NOW,
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    expect(authorizationHeaders).toEqual(["Bearer oauth-access-secret"]);

    const statusOut = new MemoryWriter();
    expect(await runCli(["auth", "status", "--json"], {
      stdout: statusOut,
      stderr: new MemoryWriter(),
      env: {},
      now: () => NOW,
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    const statusPayload = JSON.parse(statusOut.toString());
    expect(statusPayload.method).toBe("oauth");
    expect(statusPayload.scopes).toEqual(["mallary.read"]);
    expect(statusOut.toString()).not.toContain("oauth-access-secret");
    expect(statusOut.toString()).not.toContain("oauth-refresh-secret");
  });

  it("refreshes an expired OAuth access token and saves the rotated tokens", async () => {
    const filePath = await credentialFile();
    await saveOAuthCredentials(filePath, credentials({ expires_at: NOW - 1_000 }));
    const authorizationHeaders: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === "https://auth.mallary.ai/token") {
        expect(String(init?.body || "")).toContain("refresh_token=oauth-refresh-secret");
        return jsonResponse({
          access_token: "rotated-access-token",
          refresh_token: "rotated-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "openid offline_access mallary.read",
        });
      }
      authorizationHeaders.push(new Headers(init?.headers).get("authorization") || "");
      return jsonResponse({ status: "ok", data: { profiles: [] } });
    };

    expect(await runCli(["profiles", "list", "--json"], {
      stdout: new MemoryWriter(),
      stderr: new MemoryWriter(),
      env: {},
      fetch: fetchImpl,
      now: () => NOW,
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    expect(authorizationHeaders).toEqual(["Bearer rotated-access-token"]);
    const stored = JSON.parse(await readFile(filePath, "utf8"));
    expect(stored.access_token).toBe("rotated-access-token");
    expect(stored.refresh_token).toBe("rotated-refresh-token");
  });

  it("gives MALLARY_API_KEY precedence over stored OAuth", async () => {
    const filePath = await credentialFile();
    await saveOAuthCredentials(filePath, credentials());
    let authorization = "";
    const fetchImpl: typeof fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization") || "";
      return jsonResponse({ status: "ok", data: { profiles: [] } });
    };

    expect(await runCli(["profiles", "list", "--json"], {
      stdout: new MemoryWriter(),
      stderr: new MemoryWriter(),
      env: { MALLARY_API_KEY: "api-key-secret" },
      fetch: fetchImpl,
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    expect(authorization).toBe("Bearer api-key-secret");

    const statusOut = new MemoryWriter();
    expect(await runCli(["auth", "status", "--json"], {
      stdout: statusOut,
      stderr: new MemoryWriter(),
      env: { MALLARY_API_KEY: "api-key-secret" },
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    expect(JSON.parse(statusOut.toString())).toEqual({
      authenticated: true,
      method: "api_key",
      source: "MALLARY_API_KEY",
      oauth_credentials_stored: true,
    });
    expect(statusOut.toString()).not.toContain("api-key-secret");
  });

  it("requires an approved OAuth scope for mutating commands", async () => {
    const filePath = await credentialFile();
    await saveOAuthCredentials(filePath, credentials());
    const stdout = new MemoryWriter();
    const code = await runCli(
      ["posts", "create", "--message", "Hello", "--platform", "facebook", "--json"],
      {
        stdout,
        stderr: new MemoryWriter(),
        env: {},
        oauthCredentialPath: () => filePath,
      }
    );
    expect(code).toBe(1);
    expect(JSON.parse(stdout.toString()).error.code).toBe("oauth_scope_required");
  });

  it("revokes and removes stored OAuth credentials on logout", async () => {
    const filePath = await credentialFile();
    await saveOAuthCredentials(filePath, credentials());
    let revocationBody = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://auth.mallary.ai/token/revocation");
      revocationBody = String(init?.body || "");
      return new Response("", { status: 200 });
    };
    const stdout = new MemoryWriter();
    expect(await runCli(["auth", "logout", "--json"], {
      stdout,
      stderr: new MemoryWriter(),
      env: {},
      fetch: fetchImpl,
      oauthCredentialPath: () => filePath,
    })).toBe(0);
    expect(JSON.parse(stdout.toString())).toEqual({
      authenticated: false,
      oauth_removed: true,
      oauth_revoked: true,
      api_key_active: false,
    });
    expect(revocationBody).toContain("token=oauth-refresh-secret");
    await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(stdout.toString()).not.toContain("oauth-refresh-secret");
  });
});
