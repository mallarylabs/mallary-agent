import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/main.js";
import { CLI_VERSION } from "../src/version.js";

class MemoryWriter {
  chunks: string[] = [];

  write(chunk: string) {
    this.chunks.push(String(chunk));
  }

  toString() {
    return this.chunks.join("");
  }
}

function createMallaryFetch(baseUrl: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input.url || "");
    if (raw.startsWith("https://mallary.ai")) {
      const url = new URL(raw);
      return fetch(`${baseUrl}${url.pathname}${url.search}`, init);
    }
    return fetch(input as RequestInfo, init);
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function withServer(
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    state: { requests: Array<{ method: string; url: string; body: string }> },
    body: string
  ) => Promise<void> | void,
  run: (baseUrl: string, state: { requests: Array<{ method: string; url: string; body: string }> }) => Promise<void>
) {
  const state = { requests: [] as Array<{ method: string; url: string; body: string }> };
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    state.requests.push({
      method: String(req.method || ""),
      url: String(req.url || ""),
      body,
    });
    await handler(req, res, state, body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve test server address");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl, state);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
  }
});

async function makeTempFile(name: string, content: string | Buffer) {
  const dir = await mkdtemp(path.join(tmpdir(), "mallary-cli-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, name);
  await writeFile(filePath, content);
  return filePath;
}

describe("mallary cli", () => {
  it("prints the package version", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const code = await runCli(["--version"], { stdout, stderr });
    expect(code).toBe(0);
    expect(stdout.toString().trim()).toBe(CLI_VERSION);
    expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(stderr.toString()).toBe("");
  });

  it("prints health in json mode", async () => {
    await withServer(
      async (req, res) => {
        if (req.url === "/health") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["health", "--json"], { stdout, stderr, fetch: createMallaryFetch(baseUrl) });
        expect(code).toBe(0);
        expect(JSON.parse(stdout.toString())).toEqual({ ok: true });
        expect(stderr.toString()).toBe("");
      }
    );
  });

  it("requires OAuth or MALLARY_API_KEY for authenticated commands", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const code = await runCli(["posts", "list", "--json"], {
      stdout,
      stderr,
      env: {},
    });
    expect(code).toBe(1);
    expect(JSON.parse(stdout.toString())).toEqual({
      ok: false,
      error: {
        http_status: 0,
        code: "authentication_required",
        message:
          "Authenticate with `mallary auth login`, or set MALLARY_API_KEY through a secure environment or secret manager.",
      },
    });
  });

  it("rejects mutually exclusive posts create file and flag modes", async () => {
    const payloadPath = await makeTempFile("post.json", JSON.stringify({ message: "Hello", platforms: ["facebook"] }));
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const code = await runCli(["posts", "create", "--file", payloadPath, "--message", "Hello again"], {
      stdout,
      stderr,
      env: { MALLARY_API_KEY: "test" },
    });
    expect(code).toBe(1);
    expect(stderr.toString()).toContain("--file cannot be combined");
  });

  it("uploads local files end-to-end", async () => {
    const filePath = await makeTempFile("hello.txt", "hello world");
    let uploaded = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/upload" && req.method === "POST") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              uploadUrl: `${new URL(`http://127.0.0.1`).origin}/upload/1`,
              mediaUrl: "https://files.mallary.ai/hello.txt",
              storageKey: "uploads/hello.txt",
              contentType: "application/octet-stream",
              headers: { "content-type": "application/octet-stream" },
            }).replace("http://127.0.0.1", `http://127.0.0.1:${(res.socket.address() as any).port}`)
          );
          return;
        }
        if (req.url === "/upload/1" && req.method === "PUT") {
          uploaded = body;
          res.statusCode = 200;
          res.end("");
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["upload", filePath, "--json"], {
          stdout,
          stderr,
          env: { MALLARY_API_KEY: "test" },
          fetch: createMallaryFetch(baseUrl),
        });
        expect(code).toBe(0);
        expect(uploaded).toBe("hello world");
        const payload = JSON.parse(stdout.toString());
        expect(payload.ok).toBe(true);
        expect(payload.uploads[0].media_url).toBe("https://files.mallary.ai/hello.txt");
        expect(stderr.toString()).toBe("");
      }
    );
  });

  it("prints platform post IDs and URLs from post and job responses", async () => {
    await withServer(
      async (req, res) => {
        if (req.url === "/api/v1/post" && req.method === "POST") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "queued",
              batch_id: "batch-links",
              jobs: [
                {
                  platform: "facebook",
                  jobId: "123",
                  platform_post_id: "page_123",
                  platform_post_url: "https://www.facebook.com/page/posts/123",
                },
              ],
            })
          );
          return;
        }
        if (req.url === "/api/v1/jobs/123" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                job: {
                  id: "123",
                  platform: "facebook",
                  status: "completed",
                  attemptsMade: 1,
                  platform_post_id: "page_123",
                  platform_post_url: "https://www.facebook.com/page/posts/123",
                },
              },
            })
          );
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const env = { MALLARY_API_KEY: "test" };
        const fetch = createMallaryFetch(baseUrl);

        const createOut = new MemoryWriter();
        expect(
          await runCli(["posts", "create", "--message", "Hello", "--platform", "facebook"], {
            stdout: createOut,
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(createOut.toString()).toContain("Post ID: page_123");
        expect(createOut.toString()).toContain("Post URL: https://www.facebook.com/page/posts/123");

        const jobOut = new MemoryWriter();
        expect(await runCli(["jobs", "get", "123"], { stdout: jobOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(jobOut.toString()).toContain("Post ID: page_123");
        expect(jobOut.toString()).toContain("Post URL: https://www.facebook.com/page/posts/123");
      }
    );
  });

  it("fails when the upload PUT request fails", async () => {
    const filePath = await makeTempFile("broken.txt", "oops");

    await withServer(
      async (req, res) => {
        if (req.url === "/api/v1/upload" && req.method === "POST") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              uploadUrl: `${new URL(`http://127.0.0.1`).origin}/upload/1`,
              mediaUrl: "https://files.mallary.ai/broken.txt",
              storageKey: "uploads/broken.txt",
              contentType: "application/octet-stream",
            }).replace("http://127.0.0.1", `http://127.0.0.1:${(res.socket.address() as any).port}`)
          );
          return;
        }
        if (req.url === "/upload/1" && req.method === "PUT") {
          res.statusCode = 500;
          res.end("boom");
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["upload", filePath, "--json"], {
          stdout,
          stderr,
          env: { MALLARY_API_KEY: "test" },
          fetch: createMallaryFetch(baseUrl),
        });
        expect(code).toBe(2);
        const payload = JSON.parse(stdout.toString());
        expect(payload.ok).toBe(false);
        expect(payload.error.code).toBe("upload_failed");
      }
    );
  });

  it("creates posts with local media uploads and emits convenience json", async () => {
    const filePath = await makeTempFile("photo.jpg", "binary-data");
    let postedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/upload" && req.method === "POST") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              uploadUrl: `${new URL(`http://127.0.0.1`).origin}/upload/photo`,
              mediaUrl: "https://files.mallary.ai/photo.jpg",
              storageKey: "uploads/photo.jpg",
              contentType: "image/jpeg",
              headers: { "content-type": "image/jpeg" },
            }).replace("http://127.0.0.1", `http://127.0.0.1:${(res.socket.address() as any).port}`)
          );
          return;
        }
        if (req.url === "/upload/photo" && req.method === "PUT") {
          res.statusCode = 200;
          res.end("");
          return;
        }
        if (req.url === "/api/v1/post" && req.method === "POST") {
          postedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "queued", batch_id: "batch-1", jobs: [{ platform: "facebook", jobId: "123" }] }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(
          ["posts", "create", "--message", "Hello", "--platform", "facebook", "--media", filePath, "--json"],
          {
            stdout,
            stderr,
            env: { MALLARY_API_KEY: "test" },
            fetch: createMallaryFetch(baseUrl),
          }
        );
        expect(code).toBe(0);
        expect(JSON.parse(postedBody)).toEqual({
          message: "Hello",
          platforms: ["facebook"],
          media: [{ url: "https://files.mallary.ai/photo.jpg" }],
        });
        const payload = JSON.parse(stdout.toString());
        expect(payload.ok).toBe(true);
        expect(payload.uploads).toHaveLength(1);
        expect(payload.response.batch_id).toBe("batch-1");
      }
    );
  });

  it("creates posts with a local video thumbnail upload in flag mode", async () => {
    const videoPath = await makeTempFile("video.mp4", "video-data");
    const thumbnailPath = await makeTempFile("cover.jpg", "cover-data");
    let uploadCount = 0;
    let postedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/upload" && req.method === "POST") {
          uploadCount += 1;
          const isThumbnail = body.includes("cover.jpg");
          const slug = isThumbnail ? "cover" : "video";
          const contentType = isThumbnail ? "image/jpeg" : "video/mp4";
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              uploadUrl: `${new URL(`http://127.0.0.1`).origin}/upload/${slug}`,
              mediaUrl: `https://files.mallary.ai/${slug}.${isThumbnail ? "jpg" : "mp4"}`,
              storageKey: `uploads/${slug}`,
              contentType,
              headers: { "content-type": contentType },
            }).replace("http://127.0.0.1", `http://127.0.0.1:${(res.socket.address() as any).port}`)
          );
          return;
        }
        if ((req.url === "/upload/video" || req.url === "/upload/cover") && req.method === "PUT") {
          res.statusCode = 200;
          res.end("");
          return;
        }
        if (req.url === "/api/v1/post" && req.method === "POST") {
          postedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "queued", batch_id: "batch-thumb", jobs: [{ platform: "youtube", jobId: "123" }] }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(
          [
            "posts",
            "create",
            "--message",
            "Hello",
            "--platform",
            "youtube",
            "--media",
            videoPath,
            "--thumbnail",
            thumbnailPath,
            "--json",
          ],
          {
            stdout,
            stderr,
            env: { MALLARY_API_KEY: "test" },
            fetch: createMallaryFetch(baseUrl),
          }
        );
        expect(code).toBe(0);
        expect(uploadCount).toBe(2);
        expect(JSON.parse(postedBody)).toEqual({
          message: "Hello",
          platforms: ["youtube"],
          media: [{ url: "https://files.mallary.ai/video.mp4", thumbnail_url: "https://files.mallary.ai/cover.jpg" }],
        });
        const payload = JSON.parse(stdout.toString());
        expect(payload.uploads).toHaveLength(2);
        expect(stderr.toString()).toBe("");
      }
    );
  });

  it("passes scheduled timezone fields through in flag mode", async () => {
    let postedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/post" && req.method === "POST") {
          postedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "queued", batch_id: "batch-2", jobs: [{ platform: "threads", jobId: "987" }] }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(
          [
            "posts",
            "create",
            "--message",
            "Scheduled",
            "--platform",
            "threads",
            "--scheduled-at",
            "2026-04-06T09:30",
            "--scheduled-timezone",
            "America/Los_Angeles",
            "--json",
          ],
          {
            stdout,
            stderr,
            env: { MALLARY_API_KEY: "test" },
            fetch: createMallaryFetch(baseUrl),
          }
        );
        expect(code).toBe(0);
        expect(JSON.parse(postedBody)).toEqual({
          message: "Scheduled",
          platforms: ["threads"],
          scheduled_at: "2026-04-06T09:30",
          scheduled_timezone: "America/Los_Angeles",
        });
      }
    );
  });

  it("rejects scheduled timezone without scheduled-at", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const code = await runCli(
      [
        "posts",
        "create",
        "--message",
        "Hello",
        "--platform",
        "facebook",
        "--scheduled-timezone",
        "America/New_York",
      ],
      {
        stdout,
        stderr,
        env: { MALLARY_API_KEY: "test" },
      }
    );

    expect(code).toBe(1);
    expect(stderr.toString()).toContain("--scheduled-timezone requires --scheduled-at");
  });

  it("rejects external media URLs in flag mode", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const code = await runCli(
      [
        "posts",
        "create",
        "--message",
        "Hello",
        "--platform",
        "facebook",
        "--media",
        "https://example.com/photo.jpg",
        "--json",
      ],
      {
        stdout,
        stderr,
        env: { MALLARY_API_KEY: "test" },
      }
    );
    expect(code).toBe(1);
    expect(JSON.parse(stdout.toString())).toEqual({
      ok: false,
      error: {
        http_status: 0,
        code: "external_media_url_not_allowed",
        message:
          "External media URLs are not allowed. Upload media to Mallary first so it is hosted on files.mallary.ai.",
      },
    });
  });

  it("allows existing Mallary-hosted media URLs in file mode", async () => {
    const payloadPath = await makeTempFile(
      "post.json",
      JSON.stringify({
        message: "Hello",
        platforms: ["facebook"],
        media: [{ url: "https://files.mallary.ai/uploads/photo.jpg" }],
      })
    );
    let postedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/post" && req.method === "POST") {
          postedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "queued", batch_id: "batch-cdn", jobs: [{ platform: "facebook", jobId: "321" }] }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["posts", "create", "--file", payloadPath, "--json"], {
          stdout,
          stderr,
          env: { MALLARY_API_KEY: "test" },
          fetch: createMallaryFetch(baseUrl),
        });
        expect(code).toBe(0);
        expect(JSON.parse(postedBody)).toEqual({
          message: "Hello",
          platforms: ["facebook"],
          media: [{ url: "https://files.mallary.ai/uploads/photo.jpg" }],
        });
      }
    );
  });

  it("passes platform-specific message overrides through in file mode", async () => {
    const payload = {
      message: "Shared fallback",
      platforms: ["facebook", "x"],
      platform_options: {
        facebook: { message: "Facebook-specific caption" },
        x: { message: "X-specific post" },
      },
    };
    const payloadPath = await makeTempFile("post.json", JSON.stringify(payload));
    let postedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/post" && req.method === "POST") {
          postedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "queued", batch_id: "batch-platform-messages", jobs: [] }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["posts", "create", "--file", payloadPath, "--json"], {
          stdout,
          stderr,
          env: { MALLARY_API_KEY: "test" },
          fetch: createMallaryFetch(baseUrl),
        });

        expect(code).toBe(0);
        expect(JSON.parse(postedBody)).toEqual(payload);
        expect(stderr.toString()).toBe("");
      }
    );
  });

  it("passes through list posts json unchanged", async () => {
    const responsePayload = {
      status: "ok",
      data: {
        posts: [
          { id: 1, status: "completed", platforms: ["facebook"], message: "Hello", created_at: "2026-03-24T12:00:00Z" },
        ],
      },
    };

    await withServer(
      async (req, res) => {
        if (req.url === "/api/v1/posts" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(responsePayload));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["posts", "list", "--json"], {
          stdout,
          stderr,
          env: { MALLARY_API_KEY: "test" },
          fetch: createMallaryFetch(baseUrl),
        });
        expect(code).toBe(0);
        expect(JSON.parse(stdout.toString())).toEqual(responsePayload);
      }
    );
  });

  it("lists comments and posts replies through the comments commands", async () => {
    let replyBody = "";

    await withServer(
      async (req, res, _state, body) => {
        const url = new URL(String(req.url || ""), "http://127.0.0.1");
        if (url.pathname === "/api/v1/comments" && req.method === "GET") {
          expect(url.searchParams.get("post_id")).toBe("123");
          expect(url.searchParams.get("platform")).toBe("instagram");
          expect(url.searchParams.get("profile_id")).toBe("brand-1");
          expect(url.searchParams.get("limit")).toBe("25");
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                post_id: "123",
                platform: "instagram",
                comments: [{ id: "comment-1", text: "Great post", author_username: "reader" }],
              },
            })
          );
          return;
        }
        if (url.pathname === "/api/v1/comments/reply" && req.method === "POST") {
          replyBody = body;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                post_id: "123",
                comment_id: "comment-1",
                reply_id: "reply-1",
                platform: "instagram",
              },
            })
          );
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const env = { MALLARY_API_KEY: "test" };
        const fetch = createMallaryFetch(baseUrl);

        const listOut = new MemoryWriter();
        expect(
          await runCli(
            [
              "comments",
              "list",
              "--post-id",
              "123",
              "--platform",
              "instagram",
              "--profile-id",
              "brand-1",
              "--limit",
              "25",
              "--json",
            ],
            { stdout: listOut, stderr: new MemoryWriter(), env, fetch }
          )
        ).toBe(0);
        expect(JSON.parse(listOut.toString()).data.comments[0].text).toBe("Great post");

        const replyOut = new MemoryWriter();
        expect(
          await runCli(
            [
              "comments",
              "reply",
              "--post-id",
              "123",
              "--comment-id",
              "comment-1",
              "--message",
              "Thanks for reading.",
              "--json",
            ],
            { stdout: replyOut, stderr: new MemoryWriter(), env, fetch }
          )
        ).toBe(0);
        expect(JSON.parse(replyBody)).toEqual({
          post_id: "123",
          comment_id: "comment-1",
          message: "Thanks for reading.",
        });
        expect(JSON.parse(replyOut.toString()).data.reply_id).toBe("reply-1");
      }
    );
  });

  it("shows needs-final-action text for TikTok media upload in posts list and job output", async () => {
    await withServer(
      async (req, res) => {
        if (req.url === "/api/v1/posts" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                posts: [
                  {
                    id: 506,
                    status: "action_required",
                    platforms: ["tiktok"],
                    message: "Hello TikTok",
                    created_at: "2026-04-06T22:38:21Z",
                    results: [
                      {
                        platform: "tiktok",
                        success: false,
                        action_required: {
                          code: "tiktok_complete_publish_required",
                          type: "complete_platform_publish",
                          platform: "tiktok",
                          title: "Needs final action in TikTok",
                          message:
                            "TikTok upload delivered to the creator inbox. The creator must finish editing and posting in TikTok.",
                        },
                      },
                    ],
                  },
                ],
              },
            })
          );
          return;
        }
        if (req.url === "/api/v1/jobs/506" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                job: {
                  id: 506,
                  status: "action_required",
                  attemptsMade: 1,
                  action_required: {
                    code: "tiktok_complete_publish_required",
                    type: "complete_platform_publish",
                    platform: "tiktok",
                    title: "Needs final action in TikTok",
                    message:
                      "TikTok upload delivered to the creator inbox. The creator must finish editing and posting in TikTok.",
                  },
                },
              },
            })
          );
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const env = { MALLARY_API_KEY: "test" };
        const fetch = createMallaryFetch(baseUrl);

        const postsOut = new MemoryWriter();
        expect(await runCli(["posts", "list"], { stdout: postsOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(postsOut.toString()).toContain("Needs final action in TikTok");

        const jobOut = new MemoryWriter();
        expect(await runCli(["jobs", "get", "506"], { stdout: jobOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(jobOut.toString()).toContain("Action: Needs final action in TikTok");
      }
    );
  });

  it("attaches a final TikTok post URL through the jobs command", async () => {
    let receivedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/jobs/506/tiktok/post-url" && req.method === "POST") {
          receivedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                job_id: 506,
                platform: "tiktok",
                platform_post_id: "7625779234505754638",
                platform_post_url: "https://www.tiktok.com/@mallary/video/7625779234505754638",
                analytics_refresh: "queued",
              },
            })
          );
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(
          [
            "jobs",
            "attach-tiktok-url",
            "506",
            "--url",
            "https://www.tiktok.com/@mallary/video/7625779234505754638",
          ],
          {
            stdout,
            stderr,
            env: { MALLARY_API_KEY: "test" },
            fetch: createMallaryFetch(baseUrl),
          }
        );
        expect(code).toBe(0);
        expect(JSON.parse(receivedBody)).toEqual({
          post_url: "https://www.tiktok.com/@mallary/video/7625779234505754638",
        });
        expect(stdout.toString()).toContain("Updated TikTok job 506.");
        expect(stdout.toString()).toContain("Analytics refresh queued.");
        expect(stderr.toString()).toBe("");
      }
    );
  });

  it("updates settings from a JSON file", async () => {
    const settingsFile = await makeTempFile("settings.json", JSON.stringify({ business_name: "Mallary" }));
    let receivedBody = "";

    await withServer(
      async (req, res, _state, body) => {
        if (req.url === "/api/v1/settings" && req.method === "POST") {
          receivedBody = body;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "ok", data: { business_name: "Mallary" } }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const stdout = new MemoryWriter();
        const stderr = new MemoryWriter();
        const code = await runCli(["settings", "update", "--file", settingsFile, "--json"], {
          stdout,
          stderr,
          env: { MALLARY_API_KEY: "test" },
          fetch: createMallaryFetch(baseUrl),
        });
        expect(code).toBe(0);
        expect(JSON.parse(receivedBody)).toEqual({ business_name: "Mallary" });
        expect(JSON.parse(stdout.toString())).toEqual({ status: "ok", data: { business_name: "Mallary" } });
      }
    );
  });

  it("passes profile ids through profile-scoped commands", async () => {
    const settingsFile = await makeTempFile("settings.json", JSON.stringify({ business_name: "Mallary" }));
    const seen: Record<string, unknown> = {};
    const profileId = "AbC123xYz90";

    await withServer(
      async (req, res, _state, body) => {
        const url = new URL(String(req.url || "/"), "http://mallary.test");
        res.setHeader("content-type", "application/json");

        if (url.pathname === "/api/v1/post" && req.method === "POST") {
          seen.postCreate = JSON.parse(body);
          res.end(JSON.stringify({ status: "queued", batch_id: "profile-batch", jobs: [] }));
          return;
        }
        if (url.pathname === "/api/v1/posts" && req.method === "GET") {
          seen.postsListProfile = url.searchParams.get("profile_id");
          res.end(JSON.stringify({ status: "ok", data: { posts: [] } }));
          return;
        }
        if (url.pathname === "/api/v1/analytics" && req.method === "GET") {
          seen.analyticsProfile = url.searchParams.get("profile_id");
          seen.analyticsPost = url.searchParams.get("post_id");
          res.end(JSON.stringify({ status: "ok", data: { analytics: [] } }));
          return;
        }
        if (url.pathname === "/api/v1/settings" && req.method === "GET") {
          seen.settingsGetProfile = url.searchParams.get("profile_id");
          res.end(JSON.stringify({ status: "ok", data: { business_name: "Mallary" } }));
          return;
        }
        if (url.pathname === "/api/v1/settings" && req.method === "POST") {
          seen.settingsUpdate = JSON.parse(body);
          res.end(JSON.stringify({ status: "ok", data: { business_name: "Mallary" } }));
          return;
        }
        if (url.pathname === "/api/v1/platforms" && req.method === "GET") {
          seen.platformsListProfile = url.searchParams.get("profile_id");
          res.end(JSON.stringify({ status: "ok", data: { platforms: [], connected: [], disconnected: [] } }));
          return;
        }
        if (url.pathname === "/api/v1/profiles" && req.method === "GET") {
          seen.profilesList = true;
          res.end(JSON.stringify({ status: "ok", data: { profiles: [{ id: profileId, name: "Default", is_default: true, connected_platforms: [] }] } }));
          return;
        }
        if (url.pathname === "/api/v1/disconnect" && req.method === "POST") {
          seen.disconnect = JSON.parse(body);
          res.end(JSON.stringify({ status: "ok", platform: "facebook" }));
          return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not found" }));
      },
      async (baseUrl) => {
        const env = { MALLARY_API_KEY: "test" };
        const fetch = createMallaryFetch(baseUrl);

        expect(
          await runCli(["posts", "create", "--message", "Hello", "--platform", "facebook", "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["posts", "list", "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["analytics", "list", "--post-id", "99", "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["settings", "get", "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["settings", "update", "--file", settingsFile, "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["platforms", "list", "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["profiles", "list", "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
        expect(
          await runCli(["platforms", "disconnect", "facebook", "--profile-id", profileId, "--json"], {
            stdout: new MemoryWriter(),
            stderr: new MemoryWriter(),
            env,
            fetch,
          })
        ).toBe(0);
      }
    );

    expect(seen.postCreate).toEqual({ message: "Hello", platforms: ["facebook"], profile_id: profileId });
    expect(seen.postsListProfile).toBe(profileId);
    expect(seen.analyticsProfile).toBe(profileId);
    expect(seen.analyticsPost).toBe("99");
    expect(seen.settingsGetProfile).toBe(profileId);
    expect(seen.settingsUpdate).toEqual({ business_name: "Mallary", profile_id: profileId });
    expect(seen.platformsListProfile).toBe(profileId);
    expect(seen.profilesList).toBe(true);
    expect(seen.disconnect).toEqual({ platform: "facebook", profile_id: profileId });
  });

  it("covers analytics, jobs, disconnect, and webhook commands", async () => {
    await withServer(
      async (req, res) => {
        if (req.url === "/api/v1/analytics?post_id=42" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "ok", data: { analytics: [{ post_id: 42, platform: "instagram", views: 12 }] } }));
          return;
        }
        if (req.url === "/api/v1/jobs/123" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "ok", data: { job: { id: 123, status: "completed" } } }));
          return;
        }
        if (req.url === "/api/v1/platforms" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              status: "ok",
              data: {
                platforms: [
                  { platform: "x", connected: true },
                  { platform: "facebook", connected: false },
                  { platform: "instagram", connected: true },
                ],
                connected: ["x", "instagram"],
                disconnected: ["facebook"],
                counts: { connected: 2, supported: 3 },
              },
            })
          );
          return;
        }
        if (req.url === "/api/v1/disconnect" && req.method === "POST") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "ok", platform: "facebook" }));
          return;
        }
        if (req.url === "/api/v1/webhooks" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify([{ id: 7, url: "https://example.com/hook", events: ["post.published"], active: true }]));
          return;
        }
        if (req.url === "/api/v1/webhooks" && req.method === "POST") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ id: 8, url: "https://example.com/hook", events: ["post.failed"] }));
          return;
        }
        if (req.url === "/api/v1/webhooks/8" && req.method === "DELETE") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ status: "ok" }));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      },
      async (baseUrl) => {
        const env = { MALLARY_API_KEY: "test" };
        const fetch = createMallaryFetch(baseUrl);

        const analyticsOut = new MemoryWriter();
        expect(await runCli(["analytics", "list", "--post-id", "42", "--json"], { stdout: analyticsOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(JSON.parse(analyticsOut.toString()).data.analytics[0].views).toBe(12);

        const jobOut = new MemoryWriter();
        expect(await runCli(["jobs", "get", "123", "--json"], { stdout: jobOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(JSON.parse(jobOut.toString()).data.job.status).toBe("completed");

        const platformsOut = new MemoryWriter();
        expect(await runCli(["platforms", "list", "--json"], { stdout: platformsOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(JSON.parse(platformsOut.toString()).data.connected).toEqual(["x", "instagram"]);

        const disconnectOut = new MemoryWriter();
        expect(await runCli(["platforms", "disconnect", "facebook", "--json"], { stdout: disconnectOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(JSON.parse(disconnectOut.toString()).platform).toBe("facebook");

        const webhooksListOut = new MemoryWriter();
        expect(await runCli(["webhooks", "list", "--json"], { stdout: webhooksListOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(JSON.parse(webhooksListOut.toString())[0].id).toBe(7);

        const webhooksCreateOut = new MemoryWriter();
        expect(
          await runCli(
            ["webhooks", "create", "--url", "https://example.com/hook", "--event", "post.failed", "--json"],
            { stdout: webhooksCreateOut, stderr: new MemoryWriter(), env, fetch }
          )
        ).toBe(0);
        expect(JSON.parse(webhooksCreateOut.toString()).id).toBe(8);

        const webhooksDeleteOut = new MemoryWriter();
        expect(await runCli(["webhooks", "delete", "8", "--json"], { stdout: webhooksDeleteOut, stderr: new MemoryWriter(), env, fetch })).toBe(0);
        expect(JSON.parse(webhooksDeleteOut.toString()).status).toBe("ok");
      }
    );
  });
});
