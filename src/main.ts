import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { CLI_VERSION } from "./version.js";

const DEFAULT_BASE_URL = "https://mallary.ai";
const MALLARY_MEDIA_HOST = "files.mallary.ai";

type FetchLike = typeof fetch;
type JsonRecord = Record<string, unknown>;

interface WriteLike {
  write(chunk: string): unknown;
}

export interface CliDeps {
  env: NodeJS.ProcessEnv;
  fetch: FetchLike;
  stdout: WriteLike;
  stderr: WriteLike;
  readFile: typeof readFile;
  stat: typeof stat;
  cwd: () => string;
}

interface GlobalOptions {
  json: boolean;
  argv: string[];
}

interface UploadedFile {
  source_path: string;
  filename: string;
  media_url: string;
  storage_key: string | null;
  content_type: string;
  size: number;
}

interface ApiErrorPayload {
  http_status: number;
  code: string;
  message: string;
  details?: unknown;
}

interface CommandResult {
  json: unknown;
  renderHuman: (stdout: WriteLike) => void;
}

class CliError extends Error {
  readonly exitCode: number;
  readonly payload: ApiErrorPayload;

  constructor(exitCode: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.exitCode = exitCode;
    this.payload = payload;
  }
}

function defaultDeps(): CliDeps {
  return {
    env: process.env,
    fetch: globalThis.fetch.bind(globalThis),
    stdout: process.stdout,
    stderr: process.stderr,
    readFile,
    stat,
    cwd: () => process.cwd(),
  };
}

function writeLine(stream: WriteLike, text = "") {
  stream.write(`${text}\n`);
}

function parseMaybeJson(raw: string): unknown {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractApiError(status: number, body: unknown, raw: string): ApiErrorPayload {
  const obj = isObject(body) ? body : null;
  const topError = obj && isObject(obj.error) ? obj.error : null;
  const dataError =
    obj && isObject(obj.data) && isObject((obj.data as JsonRecord).error)
      ? ((obj.data as JsonRecord).error as JsonRecord)
      : null;
  const source = topError || dataError || obj;

  const code = String(
    source?.code ||
      source?.error_code ||
      source?.status ||
      (status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "request_failed")
  );

  const message = String(
    source?.message ||
      source?.error ||
      (typeof body === "string" && body) ||
      raw ||
      "Request failed"
  );

  const details = source && "details" in source ? source.details : undefined;
  return details === undefined
    ? { http_status: status, code, message }
    : { http_status: status, code, message, details };
}

function createError(exitCode: number, code: string, message: string, details?: unknown) {
  return new CliError(exitCode, details === undefined
    ? { http_status: exitCode === 2 ? 500 : 0, code, message }
    : { http_status: exitCode === 2 ? 500 : 0, code, message, details });
}

function buildRequestUrl(requestPath: string): string {
  return `${DEFAULT_BASE_URL}${requestPath}`;
}

function getApiKey(env: NodeJS.ProcessEnv): string {
  return String(env.MALLARY_API_KEY || "").trim();
}

function ensureApiKey(env: NodeJS.ProcessEnv): string {
  const apiKey = getApiKey(env);
  if (!apiKey) {
    throw new CliError(1, {
      http_status: 0,
      code: "missing_api_key",
      message: "MALLARY_API_KEY is required for this command.",
    });
  }
  return apiKey;
}

function extractGlobalOptions(argv: string[]): GlobalOptions {
  const cleaned: string[] = [];
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
      continue;
    }
    cleaned.push(arg);
  }

  return { json, argv: cleaned };
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isMallaryHostedMediaUrl(value: string): boolean {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && url.hostname === MALLARY_MEDIA_HOST;
  } catch (_) {
    return false;
  }
}

function ensureMallaryHostedMediaUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (isMallaryHostedMediaUrl(trimmed)) return trimmed;
  throw new CliError(1, {
    http_status: 0,
    code: "external_media_url_not_allowed",
    message:
      `External media URLs are not allowed. Upload media to Mallary first so it is hosted on ${MALLARY_MEDIA_HOST}.`,
  });
}

function looksLikeBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function detectMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    case ".mpeg":
    case ".mpg":
      return "video/mpeg";
    default:
      return "application/octet-stream";
  }
}

async function readJsonFile(deps: CliDeps, filePath: string): Promise<unknown> {
  try {
    const raw = await deps.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error: any) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_json_file",
      message: `Unable to read JSON file: ${filePath}`,
      details: { cause: error?.message || "unknown" },
    });
  }
}

async function performRequest(
  deps: CliDeps,
  options: {
    method: "GET" | "POST" | "DELETE" | "PUT";
    baseUrl: string;
    requestPath: string;
    apiKey?: string;
    headers?: Record<string, string>;
    body?: unknown;
    jsonBody?: boolean;
  }
): Promise<{ status: number; ok: boolean; data: unknown; raw: string }> {
  const { method, baseUrl, requestPath, apiKey, headers, body, jsonBody = true } = options;
  const requestHeaders = new Headers();
  requestHeaders.set("accept", "application/json");
  requestHeaders.set("x-mallary-client", "cli");
  requestHeaders.set("user-agent", `mallary-cli/${CLI_VERSION}`);
  if (apiKey) {
    requestHeaders.set("authorization", `Bearer ${apiKey}`);
  }
  for (const [key, value] of Object.entries(headers || {})) {
    requestHeaders.set(key, value);
  }

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (jsonBody) {
      requestHeaders.set("content-type", "application/json");
      payload = JSON.stringify(body);
    } else if (body instanceof Uint8Array || typeof Buffer !== "undefined" && Buffer.isBuffer(body)) {
      payload = body as BodyInit;
    } else if (typeof body === "string") {
      payload = body;
    } else {
      payload = body as BodyInit;
    }
  }

  const response = await deps.fetch(buildRequestUrl(requestPath), {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const raw = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    data: parseMaybeJson(raw),
    raw,
  };
}

async function apiRequest(
  deps: CliDeps,
  options: {
    method: "GET" | "POST" | "DELETE";
    baseUrl: string;
    requestPath: string;
    apiKey?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<unknown> {
  const response = await performRequest(deps, {
    method: options.method,
    baseUrl: options.baseUrl,
    requestPath: options.requestPath,
    apiKey: options.apiKey,
    body: options.body,
    headers: options.headers,
  });

  if (!response.ok) {
    throw new CliError(2, extractApiError(response.status, response.data, response.raw));
  }

  return response.data;
}

async function uploadLocalFile(
  deps: CliDeps,
  baseUrl: string,
  apiKey: string,
  inputPath: string
): Promise<UploadedFile> {
  const absolutePath = path.resolve(deps.cwd(), inputPath);
  let fileStat;
  try {
    fileStat = await deps.stat(absolutePath);
  } catch (error: any) {
    throw new CliError(1, {
      http_status: 0,
      code: "file_not_found",
      message: `File not found: ${inputPath}`,
      details: { cause: error?.message || "unknown" },
    });
  }
  if (!fileStat.isFile()) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_file",
      message: `Not a file: ${inputPath}`,
    });
  }

  const filename = path.basename(absolutePath);
  const contentType = detectMimeType(filename);
  const uploadMeta = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/upload",
    apiKey,
    body: {
      filename,
      size: fileStat.size,
      type: contentType,
    },
  });

  if (!isObject(uploadMeta) || typeof uploadMeta.uploadUrl !== "string" || typeof uploadMeta.mediaUrl !== "string") {
    throw new CliError(2, {
      http_status: 500,
      code: "invalid_upload_response",
      message: "Mallary returned an invalid upload response.",
      details: uploadMeta,
    });
  }

  const headers: Record<string, string> = {};
  if (isObject(uploadMeta.headers)) {
    for (const [key, value] of Object.entries(uploadMeta.headers)) {
      if (typeof value === "string") headers[key] = value;
    }
  }
  if (!("content-type" in lowerCaseKeys(headers)) && !("Content-Type" in headers)) {
    headers["content-type"] = typeof uploadMeta.contentType === "string" && uploadMeta.contentType
      ? uploadMeta.contentType
      : contentType;
  }

  const fileBytes = await deps.readFile(absolutePath);
  const putResponse = await deps.fetch(String(uploadMeta.uploadUrl), {
    method: "PUT",
    headers,
    body: fileBytes,
  });

  if (!putResponse.ok) {
    throw new CliError(2, {
      http_status: putResponse.status,
      code: "upload_failed",
      message: `Upload failed for ${inputPath}.`,
      details: { status_text: putResponse.statusText || null },
    });
  }

  return {
    source_path: inputPath,
    filename,
    media_url: String(uploadMeta.mediaUrl),
    storage_key: typeof uploadMeta.storageKey === "string" ? uploadMeta.storageKey : null,
    content_type:
      typeof uploadMeta.contentType === "string" && uploadMeta.contentType
        ? uploadMeta.contentType
        : contentType,
    size: Number(fileStat.size),
  };
}

function lowerCaseKeys(value: Record<string, string>): Record<string, string> {
  const lowered: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) lowered[key.toLowerCase()] = val;
  return lowered;
}

async function resolveMediaItems(
  deps: CliDeps,
  baseUrl: string,
  apiKey: string,
  media: unknown[]
): Promise<{ mediaPayload: unknown[]; uploads: UploadedFile[] }> {
  const mediaPayload: unknown[] = [];
  const uploads: UploadedFile[] = [];

  for (const item of media) {
    if (typeof item === "string") {
      if (isRemoteUrl(item)) {
        mediaPayload.push({ url: ensureMallaryHostedMediaUrl(item) });
      } else {
        const upload = await uploadLocalFile(deps, baseUrl, apiKey, item);
        uploads.push(upload);
        mediaPayload.push({ url: upload.media_url });
      }
      continue;
    }

    if (isObject(item) && typeof item.url === "string") {
      if (isRemoteUrl(item.url)) {
        mediaPayload.push({ ...item, url: ensureMallaryHostedMediaUrl(item.url) });
      } else {
        const upload = await uploadLocalFile(deps, baseUrl, apiKey, item.url);
        uploads.push(upload);
        mediaPayload.push({ ...item, url: upload.media_url });
      }
      continue;
    }

    mediaPayload.push(item);
  }

  return { mediaPayload, uploads };
}

function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function printHeading(stdout: WriteLike, text: string) {
  writeLine(stdout, text);
  writeLine(stdout, "-".repeat(text.length));
}

function getHelpText(commandPath?: string[]): string {
  const pathKey = (commandPath || []).join(" ").trim();
  switch (pathKey) {
    case "health":
      return [
        "Usage: mallary health [--json]",
        "",
        "Check Mallary API health.",
      ].join("\n");
    case "upload":
      return [
        "Usage: mallary upload <file...> [--json]",
        "",
        "Create Mallary upload URLs and upload local files end-to-end.",
      ].join("\n");
    case "posts create":
      return [
        "Usage: mallary posts create [options]",
        "",
        "Flag mode:",
        "  mallary posts create --message \"Hello\" --platform facebook --platform instagram [--media ./file.jpg] [--comment \"...\" ] [--scheduled-at <iso>] [--idempotency-key <key>]",
        "",
        "File mode:",
        "  mallary posts create --file payload.json [--idempotency-key <key>]",
        "",
        "Notes:",
        "  - --file is mutually exclusive with payload-building flags such as --message, --platform, --media, --comment, --scheduled-at, --auto-reply-enabled, and --webhook-url.",
        "  - Local media paths are uploaded automatically before the post request.",
      ].join("\n");
    case "posts list":
      return "Usage: mallary posts list [--page <n>] [--per-page <n>] [--json]";
    case "posts delete":
      return "Usage: mallary posts delete <id> [--json]";
    case "jobs get":
      return "Usage: mallary jobs get <id> [--json]";
    case "analytics list":
      return "Usage: mallary analytics list [--post-id <id>] [--json]";
    case "webhooks list":
      return "Usage: mallary webhooks list [--json]";
    case "webhooks create":
      return "Usage: mallary webhooks create --url <url> [--event <event> ...] [--secret <secret>] [--json]";
    case "webhooks delete":
      return "Usage: mallary webhooks delete <id> [--json]";
    case "settings get":
      return "Usage: mallary settings get [--json]";
    case "settings update":
      return "Usage: mallary settings update --file partial.json [--json]";
    case "platforms disconnect":
      return "Usage: mallary platforms disconnect <platform> [--json]";
    default:
      return [
        `Mallary CLI v${CLI_VERSION}`,
        "",
        "Usage:",
        "  mallary <command> [subcommand] [options]",
        "",
        "Commands:",
        "  health",
        "  upload <file...>",
        "  posts create|list|delete",
        "  jobs get <id>",
        "  analytics list",
        "  webhooks list|create|delete",
        "  settings get|update",
        "  platforms disconnect <platform>",
        "",
        "Global options:",
        "  --json",
        "  --version",
        "",
        "Auth:",
        "  Set MALLARY_API_KEY for all authenticated commands.",
      ].join("\n");
  }
}

function result(json: unknown, renderHuman: (stdout: WriteLike) => void): CommandResult {
  return { json, renderHuman };
}

function parseSinglePositional(name: string, value: string | undefined): string {
  if (!value) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: `${name} is required.`,
    });
  }
  return value;
}

async function runHealth(deps: CliDeps, baseUrl: string): Promise<CommandResult> {
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: "/health",
  });
  return result(response, (stdout) => {
    writeLine(stdout, `Mallary API is healthy at ${baseUrl}`);
  });
}

async function runUpload(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["upload"]) }, (stdout) => writeLine(stdout, getHelpText(["upload"])));
  }
  const files = parsed.positionals;
  if (files.length === 0) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "At least one file path is required.",
    });
  }

  const apiKey = ensureApiKey(deps.env);
  const uploads: UploadedFile[] = [];
  for (const file of files) {
    uploads.push(await uploadLocalFile(deps, baseUrl, apiKey, file));
  }

  return result(
    { ok: true, uploads },
    (stdout) => {
      printHeading(stdout, "Uploads");
      uploads.forEach((upload) => {
        writeLine(stdout, `${upload.source_path} -> ${upload.media_url}`);
      });
    }
  );
}

function ensureExclusiveFileMode(parsedValues: JsonRecord, conflictingKeys: string[]) {
  const used = conflictingKeys.filter((key) => {
    const value = parsedValues[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value === true;
  });
  if (used.length > 0) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: `--file cannot be combined with: ${used.map((key) => `--${key}`).join(", ")}`,
    });
  }
}

async function buildPostPayload(
  deps: CliDeps,
  baseUrl: string,
  apiKey: string,
  args: string[]
): Promise<{ payload: JsonRecord; uploads: UploadedFile[]; idempotencyKey?: string }> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      file: { type: "string" },
      message: { type: "string" },
      platform: { type: "string", multiple: true },
      media: { type: "string", multiple: true },
      comment: { type: "string", multiple: true },
      "scheduled-at": { type: "string" },
      "idempotency-key": { type: "string" },
      "webhook-url": { type: "string" },
      "auto-reply-enabled": { type: "boolean" },
    },
  });

  if (parsed.values.help) {
    throw new CliError(1, {
      http_status: 0,
      code: "help_requested",
      message: getHelpText(["posts", "create"]),
    });
  }

  const idempotencyKey =
    typeof parsed.values["idempotency-key"] === "string"
      ? parsed.values["idempotency-key"]
      : undefined;

  if (typeof parsed.values.file === "string") {
    ensureExclusiveFileMode(parsed.values as JsonRecord, [
      "message",
      "platform",
      "media",
      "comment",
      "scheduled-at",
      "webhook-url",
      "auto-reply-enabled",
    ]);
    const payload = await readJsonFile(deps, parsed.values.file);
    if (!isObject(payload)) {
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_payload",
        message: "Post payload file must contain a JSON object.",
      });
    }
    const uploads: UploadedFile[] = [];
    if (Array.isArray(payload.media)) {
      const resolved = await resolveMediaItems(deps, baseUrl, apiKey, payload.media);
      payload.media = resolved.mediaPayload;
      uploads.push(...resolved.uploads);
    }
    return { payload, uploads, idempotencyKey };
  }

  const message = typeof parsed.values.message === "string" ? parsed.values.message.trim() : "";
  const platforms = Array.isArray(parsed.values.platform)
    ? parsed.values.platform.map((platform) => String(platform).trim()).filter(Boolean)
    : [];
  if (!message) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "--message is required in flag mode.",
    });
  }
  if (platforms.length === 0) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "At least one --platform is required in flag mode.",
    });
  }

  const mediaEntries = Array.isArray(parsed.values.media) ? parsed.values.media : [];
  const resolved = await resolveMediaItems(deps, baseUrl, apiKey, mediaEntries);
  const payload: JsonRecord = {
    message,
    platforms,
  };
  if (resolved.mediaPayload.length > 0) payload.media = resolved.mediaPayload;
  if (Array.isArray(parsed.values.comment) && parsed.values.comment.length > 0) {
    payload.comments_under_post = parsed.values.comment;
  }
  if (typeof parsed.values["scheduled-at"] === "string" && parsed.values["scheduled-at"].trim()) {
    payload.scheduled_at = parsed.values["scheduled-at"].trim();
  }
  if (typeof parsed.values["webhook-url"] === "string" && parsed.values["webhook-url"].trim()) {
    payload.webhook_url = parsed.values["webhook-url"].trim();
  }
  if (looksLikeBoolean(parsed.values["auto-reply-enabled"])) {
    payload.auto_reply_enabled = parsed.values["auto-reply-enabled"];
  }
  return { payload, uploads: resolved.uploads, idempotencyKey };
}

async function runPostsCreate(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const { payload, uploads, idempotencyKey } = await buildPostPayload(deps, baseUrl, apiKey, args);
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/post",
    apiKey,
    body: payload,
    headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
  });

  const json = uploads.length > 0 ? { ok: true, uploads, response } : response;
  return result(json, (stdout) => {
    const responseObj = isObject(response) ? response : {};
    writeLine(stdout, `Queued post${uploads.length > 0 ? ` with ${uploads.length} uploaded file(s)` : ""}.`);
    if (typeof responseObj.batch_id === "string") {
      writeLine(stdout, `Batch ID: ${responseObj.batch_id}`);
    }
    if (Array.isArray(responseObj.jobs) && responseObj.jobs.length > 0) {
      writeLine(stdout, "Jobs:");
      responseObj.jobs.forEach((job) => {
        if (isObject(job)) {
          writeLine(stdout, `- ${formatValue(job.platform)}: ${formatValue(job.jobId)}`);
        }
      });
    }
  });
}

async function runPostsList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      page: { type: "string" },
      "per-page": { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["posts", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["posts", "list"])));
  }
  const params = new URLSearchParams();
  if (typeof parsed.values.page === "string") params.set("page", parsed.values.page);
  if (typeof parsed.values["per-page"] === "string") params.set("per_page", parsed.values["per-page"]);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: `/api/v1/posts${suffix}`,
    apiKey,
  });
  return result(response, (stdout) => {
    const posts = isObject(response) && isObject(response.data) && Array.isArray((response.data as JsonRecord).posts)
      ? ((response.data as JsonRecord).posts as unknown[])
      : [];
    writeLine(stdout, `Found ${posts.length} post(s).`);
    posts.forEach((post) => {
      if (!isObject(post)) return;
      writeLine(
        stdout,
        `- ${formatValue(post.id)} | ${formatValue(post.status)} | ${formatValue(post.platforms)} | ${formatValue(post.created_at)}`
      );
      writeLine(stdout, `  ${String(post.message || "").slice(0, 120)}`);
    });
  });
}

async function runPostsDelete(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["posts", "delete"]) }, (stdout) => writeLine(stdout, getHelpText(["posts", "delete"])));
  }
  const id = parseSinglePositional("id", parsed.positionals[0]);
  const response = await apiRequest(deps, {
    method: "DELETE",
    baseUrl,
    requestPath: `/api/v1/posts/${encodeURIComponent(id)}`,
    apiKey,
  });
  return result(response, (stdout) => {
    writeLine(stdout, `Deleted post ${id}.`);
  });
}

async function runJobGet(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["jobs", "get"]) }, (stdout) => writeLine(stdout, getHelpText(["jobs", "get"])));
  }
  const id = parseSinglePositional("id", parsed.positionals[0]);
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: `/api/v1/jobs/${encodeURIComponent(id)}`,
    apiKey,
  });
  return result(response, (stdout) => {
    const job =
      isObject(response) && isObject(response.data) && isObject((response.data as JsonRecord).job)
        ? ((response.data as JsonRecord).job as JsonRecord)
        : null;
    if (!job) {
      writeLine(stdout, `Job ${id} retrieved.`);
      return;
    }
    writeLine(stdout, `Job ${formatValue(job.id || id)}`);
    writeLine(stdout, `Status: ${formatValue(job.status)}`);
    writeLine(stdout, `Attempts: ${formatValue(job.attemptsMade)}`);
    if (job.error) writeLine(stdout, `Error: ${formatValue(job.error)}`);
    if (job.result) {
      writeLine(stdout, "Result:");
      writeLine(stdout, JSON.stringify(job.result, null, 2));
    }
  });
}

async function runAnalyticsList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "post-id": { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["analytics", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["analytics", "list"])));
  }
  const params = new URLSearchParams();
  if (typeof parsed.values["post-id"] === "string") params.set("post_id", parsed.values["post-id"]);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: `/api/v1/analytics${suffix}`,
    apiKey,
  });
  return result(response, (stdout) => {
    const analytics =
      isObject(response) && isObject(response.data) && Array.isArray((response.data as JsonRecord).analytics)
        ? ((response.data as JsonRecord).analytics as unknown[])
        : [];
    writeLine(stdout, `Found ${analytics.length} analytics row(s).`);
    analytics.forEach((row) => {
      if (!isObject(row)) return;
      writeLine(
        stdout,
        `- post ${formatValue(row.post_id)} | ${formatValue(row.platform)} | impressions ${formatValue(row.impressions)} | reach ${formatValue(row.reach)} | views ${formatValue(row.views)}`
      );
    });
  });
}

async function runWebhooksList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["webhooks", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["webhooks", "list"])));
  }
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: "/api/v1/webhooks",
    apiKey,
  });
  return result(response, (stdout) => {
    const hooks = Array.isArray(response) ? response : [];
    writeLine(stdout, `Found ${hooks.length} webhook(s).`);
    hooks.forEach((hook) => {
      if (!isObject(hook)) return;
      writeLine(stdout, `- ${formatValue(hook.id)} | ${formatValue(hook.url)} | events=${formatValue(hook.events)} | active=${formatValue(hook.active)}`);
    });
  });
}

async function runWebhooksCreate(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      url: { type: "string" },
      event: { type: "string", multiple: true },
      secret: { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["webhooks", "create"]) }, (stdout) => writeLine(stdout, getHelpText(["webhooks", "create"])));
  }
  const url = typeof parsed.values.url === "string" ? parsed.values.url.trim() : "";
  if (!url) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "--url is required.",
    });
  }
  const body: JsonRecord = { url };
  if (Array.isArray(parsed.values.event) && parsed.values.event.length > 0) body.events = parsed.values.event;
  if (typeof parsed.values.secret === "string" && parsed.values.secret.trim()) body.secret = parsed.values.secret.trim();
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/webhooks",
    apiKey,
    body,
  });
  return result(response, (stdout) => {
    const hook = isObject(response) ? response : {};
    writeLine(stdout, `Created webhook ${formatValue(hook.id)} -> ${formatValue(hook.url)}`);
  });
}

async function runWebhooksDelete(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["webhooks", "delete"]) }, (stdout) => writeLine(stdout, getHelpText(["webhooks", "delete"])));
  }
  const id = parseSinglePositional("id", parsed.positionals[0]);
  const response = await apiRequest(deps, {
    method: "DELETE",
    baseUrl,
    requestPath: `/api/v1/webhooks/${encodeURIComponent(id)}`,
    apiKey,
  });
  return result(response, (stdout) => {
    writeLine(stdout, `Deleted webhook ${id}.`);
  });
}

async function runSettingsGet(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["settings", "get"]) }, (stdout) => writeLine(stdout, getHelpText(["settings", "get"])));
  }
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: "/api/v1/settings",
    apiKey,
  });
  return result(response, (stdout) => {
    writeLine(stdout, JSON.stringify(response, null, 2));
  });
}

async function runSettingsUpdate(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      file: { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["settings", "update"]) }, (stdout) => writeLine(stdout, getHelpText(["settings", "update"])));
  }
  if (typeof parsed.values.file !== "string" || !parsed.values.file.trim()) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "--file is required.",
    });
  }
  const payload = await readJsonFile(deps, parsed.values.file);
  if (!isObject(payload)) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_payload",
      message: "Settings payload file must contain a JSON object.",
    });
  }
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/settings",
    apiKey,
    body: payload,
  });
  return result(response, (stdout) => {
    writeLine(stdout, "Updated settings.");
  });
}

async function runPlatformsDisconnect(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = ensureApiKey(deps.env);
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["platforms", "disconnect"]) }, (stdout) => writeLine(stdout, getHelpText(["platforms", "disconnect"])));
  }
  const platform = parseSinglePositional("platform", parsed.positionals[0]).toLowerCase();
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/disconnect",
    apiKey,
    body: { platform },
  });
  return result(response, (stdout) => {
    writeLine(stdout, `Disconnected ${platform}.`);
  });
}

async function dispatchCommand(deps: CliDeps, globals: GlobalOptions): Promise<CommandResult> {
  const [command, subcommand, ...rest] = globals.argv;
  const baseUrl = DEFAULT_BASE_URL;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    const helpPath = command === "help" ? [subcommand, ...rest].filter(Boolean) : [];
    return result({ help: getHelpText(helpPath) }, (stdout) => writeLine(stdout, getHelpText(helpPath)));
  }

  if (command === "--version" || command === "-v") {
    return result({ version: CLI_VERSION }, (stdout) => writeLine(stdout, CLI_VERSION));
  }

  switch (command) {
    case "health":
      return runHealth(deps, baseUrl);
    case "upload":
      return runUpload(deps, baseUrl, [subcommand, ...rest].filter((value): value is string => typeof value === "string"));
    case "posts":
      switch (subcommand) {
        case "create":
          return runPostsCreate(deps, baseUrl, rest);
        case "list":
          return runPostsList(deps, baseUrl, rest);
        case "delete":
          return runPostsDelete(deps, baseUrl, rest);
        default:
          throw new CliError(1, {
            http_status: 0,
            code: "invalid_command",
            message: "Unknown posts subcommand. Use create, list, or delete.",
          });
      }
    case "jobs":
      if (subcommand === "get") return runJobGet(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown jobs subcommand. Use get.",
      });
    case "analytics":
      if (subcommand === "list") return runAnalyticsList(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown analytics subcommand. Use list.",
      });
    case "webhooks":
      switch (subcommand) {
        case "list":
          return runWebhooksList(deps, baseUrl, rest);
        case "create":
          return runWebhooksCreate(deps, baseUrl, rest);
        case "delete":
          return runWebhooksDelete(deps, baseUrl, rest);
        default:
          throw new CliError(1, {
            http_status: 0,
            code: "invalid_command",
            message: "Unknown webhooks subcommand. Use list, create, or delete.",
          });
      }
    case "settings":
      switch (subcommand) {
        case "get":
          return runSettingsGet(deps, baseUrl, rest);
        case "update":
          return runSettingsUpdate(deps, baseUrl, rest);
        default:
          throw new CliError(1, {
            http_status: 0,
            code: "invalid_command",
            message: "Unknown settings subcommand. Use get or update.",
          });
      }
    case "platforms":
      if (subcommand === "disconnect") return runPlatformsDisconnect(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown platforms subcommand. Use disconnect.",
      });
    default:
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: `Unknown command: ${command}`,
      });
  }
}

function emitError(deps: CliDeps, jsonMode: boolean, error: unknown): number {
  const cliError =
    error instanceof CliError
      ? error
      : new CliError(1, {
          http_status: 0,
          code: "unexpected_error",
          message: error instanceof Error ? error.message : "Unexpected error",
        });

  if (cliError.payload.code === "help_requested") {
    writeLine(deps.stdout, cliError.payload.message);
    return 0;
  }

  if (jsonMode) {
    deps.stdout.write(formatJson({ ok: false, error: cliError.payload }));
  } else {
    writeLine(deps.stderr, `Error: ${cliError.payload.message}`);
    if (cliError.payload.http_status > 0) {
      writeLine(deps.stderr, `HTTP status: ${cliError.payload.http_status}`);
    }
    if (cliError.payload.code) {
      writeLine(deps.stderr, `Code: ${cliError.payload.code}`);
    }
  }
  return cliError.exitCode;
}

export async function runCli(argv: string[], overrides: Partial<CliDeps> = {}): Promise<number> {
  const deps: CliDeps = { ...defaultDeps(), ...overrides };
  let globals: GlobalOptions;
  try {
    globals = extractGlobalOptions(argv);
  } catch (error) {
    return emitError(deps, false, error);
  }

  try {
    const resultValue = await dispatchCommand(deps, globals);
    if (globals.json) {
      deps.stdout.write(formatJson(resultValue.json));
    } else {
      resultValue.renderHuman(deps.stdout);
    }
    return 0;
  } catch (error) {
    return emitError(deps, globals.json, error);
  }
}
