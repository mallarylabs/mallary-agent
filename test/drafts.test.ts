import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/main.js";

const id = "ab825ed9-2122-43d9-aa6a-620c669e0d04";
function fixture() {
  const requests: any[] = [];
  const output: string[] = [];
  const fetch = vi.fn(async (url: any, init: any) => {
    requests.push({ url: String(url), ...init, body: init.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify({ status: "ok", data: { id, revision: 2, status: "draft" } }), { status: 200 });
  });
  return { fetch, requests, output, deps: { fetch: fetch as typeof globalThis.fetch, env: { MALLARY_API_KEY: "draft-test-key" }, stdout: { write: (s: string) => output.push(s) }, stderr: { write: () => {} } } };
}
describe("saved draft CLI commands", () => {
  it("reports a normal scheduling restriction without retrying or reporting submission success", async () => {
    const f = fixture();
    f.fetch.mockImplementation(async () => new Response(JSON.stringify({ status: "error", error: { code: "scheduling_not_available", message: "Scheduling is available on paid plans." } }), { status: 403 }));
    expect(await runCli(["drafts", "submit", id, "--expected-revision", "2", "--json"], f.deps)).toBe(2);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(f.output.join("")).error).toMatchObject({ code: "scheduling_not_available", http_status: 403 });
  });
  it("saves incomplete content without making a publishing request", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "create", "--message", "Work in progress", "--json"], f.deps)).toBe(0);
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toMatchObject({ url: "https://mallary.ai/api/v1/drafts", method: "POST", body: { message: "Work in progress" } });
    expect(f.requests[0].body).not.toHaveProperty("platforms");
    expect(f.requests[0].body).not.toHaveProperty("scheduled_at");
  });
  it("only sends changed fields and the revision when editing", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "edit", id, "--message", "New text", "--expected-revision", "2", "--json"], f.deps)).toBe(0);
    expect(f.requests[0]).toMatchObject({ method: "PATCH", body: { message: "New text", expected_revision: 2 } });
    expect(f.requests[0].body).not.toHaveProperty("platforms");
    expect(f.requests[0].body).not.toHaveProperty("media");
  });
  it.each(["edit", "delete", "submit"])("requires a revision for %s before sending a request", async action => {
    const f = fixture();
    expect(await runCli(["drafts", action, id, "--json"], f.deps)).toBe(1);
    expect(f.requests).toHaveLength(0);
  });
  it("rejects a schedule on a draft save", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "create", "--scheduled-at", "2030-01-01T12:00:00Z", "--json"], f.deps)).toBe(1);
    expect(f.requests).toHaveLength(0);
  });
  it("submits the saved UUID and revision, with an explicit schedule", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "submit", id, "--expected-revision", "2", "--scheduled-at", "2030-01-01T12:00:00Z", "--json"], f.deps)).toBe(0);
    expect(f.requests[0]).toMatchObject({ url: `https://mallary.ai/api/v1/drafts/${id}/submit`, method: "POST", body: { expected_revision: 2, scheduled_at: "2030-01-01T12:00:00Z" } });
  });
  it("keeps profile and pagination on read requests", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "list", "--profile-id", "ProfileTest1", "--page", "2", "--per-page", "5", "--json"], f.deps)).toBe(0);
    expect(f.requests[0]).toMatchObject({ method: "GET", url: "https://mallary.ai/api/v1/drafts?profile_id=ProfileTest1&page=2&per_page=5" });
  });
  it("checks revision before attempting a media upload", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "edit", id, "--media", "./missing.png", "--json"], f.deps)).toBe(1);
    expect(JSON.parse(f.output.join("")).error.message).toContain("expected-revision");
    expect(f.requests).toHaveLength(0);
  });
  it("provides draft group help without authentication or network calls", async () => {
    const f = fixture();
    expect(await runCli(["drafts", "--help"], f.deps)).toBe(0);
    expect(f.output.join("")).toContain("create|list|get|edit|delete|submit");
    expect(f.requests).toHaveLength(0);
  });
});
