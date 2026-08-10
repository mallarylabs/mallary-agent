import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  OAuthClientError,
  credentialHasScope,
  defaultOAuthCredentialPath,
  loadOAuthCredentials,
  pollForDeviceToken,
  refreshOAuthCredentials,
  removeOAuthCredentials,
  requestedOAuthScopes,
  revokeOAuthCredentials,
  saveOAuthCredentials,
  startDeviceAuthorization,
  type MallaryCliOAuthScope,
} from "./oauth.js";
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
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  oauthCredentialPath: (env: NodeJS.ProcessEnv) => string;
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
    now: () => Date.now(),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    oauthCredentialPath: (env) => defaultOAuthCredentialPath(env),
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

function extractActionRequired(value: unknown): JsonRecord | null {
  return isObject(value) ? (value as JsonRecord) : null;
}

function extractPostActionRequired(post: unknown): JsonRecord | null {
  if (!isObject(post)) return null;
  const direct = extractActionRequired(post.action_required);
  if (direct) return direct;
  const results = Array.isArray(post.results) ? post.results : [];
  for (const result of results) {
    if (!isObject(result)) continue;
    const action = extractActionRequired(result.action_required);
    if (action) return action;
  }
  return null;
}

function platformPostIdentityLines(item: JsonRecord): string[] {
  const lines: string[] = [];
  const postId = item.platform_post_id;
  const postUrl = item.platform_post_url;
  if (postId) lines.push(`Post ID: ${formatValue(postId)}`);
  if (postUrl) lines.push(`Post URL: ${formatValue(postUrl)}`);
  return lines;
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

function oauthCredentialPath(deps: CliDeps): string {
  return deps.oauthCredentialPath(deps.env);
}

async function ensureAuthToken(
  deps: CliDeps,
  requiredScope: MallaryCliOAuthScope
): Promise<string> {
  const apiKey = getApiKey(deps.env);
  if (apiKey) return apiKey;

  const credentialPath = oauthCredentialPath(deps);
  const stored = await loadOAuthCredentials(credentialPath);
  if (!stored) {
    throw new CliError(1, {
      http_status: 0,
      code: "authentication_required",
      message:
        "Authenticate with `mallary auth login`, or set MALLARY_API_KEY through a secure environment or secret manager.",
    });
  }
  if (!credentialHasScope(stored, requiredScope)) {
    throw new CliError(1, {
      http_status: 0,
      code: "oauth_scope_required",
      message:
        `The stored OAuth session does not include ${requiredScope}. ` +
        "Run `mallary auth login` again and complete browser consent to update the connection.",
    });
  }
  if (stored.expires_at > deps.now() + 60_000) return stored.access_token;

  try {
    const refreshed = await refreshOAuthCredentials(deps.fetch, stored, deps.now());
    await saveOAuthCredentials(credentialPath, refreshed);
    return refreshed.access_token;
  } catch (error) {
    if (error instanceof OAuthClientError && error.code === "oauth_reauthentication_required") {
      await removeOAuthCredentials(credentialPath).catch(() => undefined);
    }
    throw error;
  }
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

async function resolveMediaLocation(
  deps: CliDeps,
  baseUrl: string,
  apiKey: string,
  value: string
): Promise<{ url: string; upload: UploadedFile | null }> {
  if (isRemoteUrl(value)) {
    return { url: ensureMallaryHostedMediaUrl(value), upload: null };
  }
  const upload = await uploadLocalFile(deps, baseUrl, apiKey, value);
  return { url: upload.media_url, upload };
}

function lowerCaseKeys(value: Record<string, string>): Record<string, string> {
  const lowered: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) lowered[key.toLowerCase()] = val;
  return lowered;
}

async function resolveThumbnailUrl(
  deps: CliDeps,
  baseUrl: string,
  apiKey: string,
  item: Record<string, unknown>,
  uploads: UploadedFile[]
): Promise<Record<string, unknown>> {
  const rawThumbnail =
    typeof item.thumbnail_url === "string"
      ? item.thumbnail_url.trim()
      : typeof item.thumbnailUrl === "string"
        ? item.thumbnailUrl.trim()
        : "";
  if (!rawThumbnail) return item;

  const resolved = await resolveMediaLocation(deps, baseUrl, apiKey, rawThumbnail);
  if (resolved.upload) uploads.push(resolved.upload);
  const next: Record<string, unknown> = { ...item, thumbnail_url: resolved.url };
  delete next.thumbnailUrl;
  return next;
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
      const resolved = await resolveMediaLocation(deps, baseUrl, apiKey, item);
      if (resolved.upload) uploads.push(resolved.upload);
      mediaPayload.push({ url: resolved.url });
      continue;
    }

    if (isObject(item) && typeof item.url === "string") {
      const resolved = await resolveMediaLocation(deps, baseUrl, apiKey, item.url);
      if (resolved.upload) uploads.push(resolved.upload);
      const withMediaUrl = { ...item, url: resolved.url };
      mediaPayload.push(await resolveThumbnailUrl(deps, baseUrl, apiKey, withMediaUrl, uploads));
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
    case "auth":
      return [
        "Usage: mallary auth login|status|logout [options]",
        "",
        "Sign in with Mallary OAuth, inspect the active authentication method, or remove stored OAuth access.",
      ].join("\n");
    case "auth login":
      return [
        "Usage: mallary auth login [--json]",
        "",
        "Sign in through a browser with a one-time code.",
        "One login grants access to view, publish, reply, and manage Mallary.",
      ].join("\n");
    case "auth status":
      return "Usage: mallary auth status [--json]";
    case "auth logout":
      return [
        "Usage: mallary auth logout [--local-only] [--json]",
        "",
        "Revoke and remove stored OAuth access. --local-only removes the local credentials without revoking them remotely.",
      ].join("\n");
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
        "  mallary posts create --message \"Hello\" --platform facebook --platform instagram [--profile-id <id>] [--media ./file.jpg] [--thumbnail ./cover.jpg] [--comment \"...\" ] [--scheduled-at <time>] [--scheduled-timezone <iana>] [--idempotency-key <key>]",
        "",
        "File mode:",
        "  mallary posts create --file payload.json [--idempotency-key <key>]",
        "",
        "Notes:",
        "  - --file is mutually exclusive with payload-building flags such as --message, --platform, --profile-id, --media, --thumbnail, --comment, --scheduled-at, --scheduled-timezone, --auto-reply-enabled, and --webhook-url.",
        "  - Use --scheduled-at with an absolute timestamp like 2026-04-06T18:30:00Z, or pair a local time like 2026-04-06T14:30 with --scheduled-timezone America/New_York.",
        "  - Local media paths are uploaded automatically before the post request.",
      ].join("\n");
    case "posts list":
      return "Usage: mallary posts list [--profile-id <id>] [--page <n>] [--per-page <n>] [--json]";
    case "posts delete":
      return "Usage: mallary posts delete <id> [--json]";
    case "comments list":
      return "Usage: mallary comments list --post-id <id> [--platform <platform>] [--profile-id <id>] [--limit <n>] [--json]";
    case "comments reply":
      return "Usage: mallary comments reply --post-id <id> --comment-id <comment_id> --message \"Reply text\" [--json]";
    case "jobs get":
      return "Usage: mallary jobs get <id> [--json]";
    case "jobs attach-tiktok-url":
      return "Usage: mallary jobs attach-tiktok-url <id> --url <tiktok_video_url> [--json]";
    case "analytics list":
      return "Usage: mallary analytics list [--profile-id <id>] [--post-id <id>] [--json]";
    case "profiles list":
      return "Usage: mallary profiles list [--json]";
    case "webhooks list":
      return "Usage: mallary webhooks list [--json]";
    case "webhooks create":
      return "Usage: mallary webhooks create --url <url> [--event <event> ...] [--secret <secret>] [--json]";
    case "webhooks delete":
      return "Usage: mallary webhooks delete <id> [--json]";
    case "settings get":
      return "Usage: mallary settings get [--profile-id <id>] [--json]";
    case "settings update":
      return "Usage: mallary settings update --file partial.json [--profile-id <id>] [--json]";
    case "platforms list":
      return "Usage: mallary platforms list [--profile-id <id>] [--json]";
    case "platforms disconnect":
      return "Usage: mallary platforms disconnect <platform> [--profile-id <id>] [--json]";
    default:
      return [
        `Mallary CLI v${CLI_VERSION}`,
        "",
        "Usage:",
        "  mallary <command> [subcommand] [options]",
        "",
        "Commands:",
        "  auth login|status|logout",
        "  health",
        "  upload <file...>",
        "  posts create|list|delete",
        "  comments list|reply",
        "  jobs get <id>",
        "  jobs attach-tiktok-url <id> --url <tiktok_video_url>",
        "  analytics list",
        "  profiles list",
        "  webhooks list|create|delete",
        "  settings get|update",
        "  platforms list|disconnect",
        "",
        "Global options:",
        "  --json",
        "  --version",
        "",
        "Auth:",
        "  Run `mallary auth login` once for full Mallary OAuth access.",
        "  MALLARY_API_KEY remains available as an optional environment override.",
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

async function runAuthStatus(deps: CliDeps, args: string[]): Promise<CommandResult> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });
  if (parsed.values.help) {
    return result(
      { help: getHelpText(["auth", "status"]) },
      (stdout) => writeLine(stdout, getHelpText(["auth", "status"]))
    );
  }

  const apiKeyActive = Boolean(getApiKey(deps.env));
  const stored = await loadOAuthCredentials(oauthCredentialPath(deps));
  if (apiKeyActive) {
    const payload = {
      authenticated: true,
      method: "api_key",
      source: "MALLARY_API_KEY",
      oauth_credentials_stored: Boolean(stored),
    };
    return result(payload, (stdout) => {
      writeLine(stdout, "Authenticated with MALLARY_API_KEY.");
      if (stored) writeLine(stdout, "Stored OAuth access is present but the API key takes precedence.");
    });
  }

  if (!stored) {
    const payload = { authenticated: false, method: null };
    return result(payload, (stdout) => {
      writeLine(stdout, "Not authenticated. Run `mallary auth login` to sign in with OAuth.");
    });
  }

  const payload = {
    authenticated: true,
    method: "oauth",
    scopes: stored.scopes.filter((scope) => scope.startsWith("mallary.")),
    expires_at: new Date(stored.expires_at).toISOString(),
    access_token_expired: stored.expires_at <= deps.now(),
    can_refresh: Boolean(stored.refresh_token),
  };
  return result(payload, (stdout) => {
    writeLine(stdout, "Authenticated with Mallary OAuth.");
    writeLine(stdout, `Scopes: ${payload.scopes.join(", ") || "none"}`);
    writeLine(stdout, `Access token expires: ${payload.expires_at}`);
    if (payload.access_token_expired) {
      writeLine(stdout, "The access token is expired and will be refreshed on the next command.");
    }
  });
}

async function runAuthLogin(deps: CliDeps, args: string[]): Promise<CommandResult> {
  const parsed = (() => {
    try {
      return parseArgs({
        args,
        allowPositionals: false,
        strict: true,
        options: {
          help: { type: "boolean", short: "h" },
        },
      });
    } catch (error) {
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_args",
        message: error instanceof Error ? error.message : "Invalid auth login options.",
      });
    }
  })();
  if (parsed.values.help) {
    return result(
      { help: getHelpText(["auth", "login"]) },
      (stdout) => writeLine(stdout, getHelpText(["auth", "login"]))
    );
  }

  const scopes = requestedOAuthScopes();
  const authorization = await startDeviceAuthorization(deps.fetch, scopes);
  writeLine(deps.stderr, "Open this Mallary sign-in page in your browser:");
  writeLine(deps.stderr, authorization.verificationUriComplete || authorization.verificationUri);
  writeLine(deps.stderr, `One-time code: ${authorization.userCode}`);
  writeLine(deps.stderr, "Waiting for browser approval...");

  const credentials = await pollForDeviceToken({
    fetchImpl: deps.fetch,
    authorization,
    now: deps.now,
    sleep: deps.sleep,
  });
  await saveOAuthCredentials(oauthCredentialPath(deps), credentials);

  const apiKeyOverride = Boolean(getApiKey(deps.env));
  const payload = {
    authenticated: true,
    method: "oauth",
    scopes: credentials.scopes.filter((scope) => scope.startsWith("mallary.")),
    expires_at: new Date(credentials.expires_at).toISOString(),
    storage: "local_credentials_file",
    api_key_override: apiKeyOverride,
  };
  return result(payload, (stdout) => {
    writeLine(stdout, "Mallary OAuth login complete.");
    writeLine(stdout, `Scopes: ${payload.scopes.join(", ") || "none"}`);
    if (apiKeyOverride) {
      writeLine(stdout, "MALLARY_API_KEY is set and will continue to take precedence over OAuth.");
    }
  });
}

async function runAuthLogout(deps: CliDeps, args: string[]): Promise<CommandResult> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "local-only": { type: "boolean" },
    },
  });
  if (parsed.values.help) {
    return result(
      { help: getHelpText(["auth", "logout"]) },
      (stdout) => writeLine(stdout, getHelpText(["auth", "logout"]))
    );
  }

  const credentialPath = oauthCredentialPath(deps);
  const stored = await loadOAuthCredentials(credentialPath);
  const localOnly = parsed.values["local-only"] === true;
  let revoked = false;
  if (stored && !localOnly) {
    await revokeOAuthCredentials(deps.fetch, stored);
    revoked = true;
  }
  const removed = await removeOAuthCredentials(credentialPath);
  const apiKeyActive = Boolean(getApiKey(deps.env));
  const payload = {
    authenticated: apiKeyActive,
    oauth_removed: removed,
    oauth_revoked: revoked,
    api_key_active: apiKeyActive,
  };
  return result(payload, (stdout) => {
    if (removed) {
      writeLine(stdout, revoked ? "Mallary OAuth access was revoked and removed." : "Stored Mallary OAuth access was removed.");
    } else {
      writeLine(stdout, "No stored Mallary OAuth access was found.");
    }
    if (apiKeyActive) {
      writeLine(stdout, "MALLARY_API_KEY is still set. Remove it from the environment or secret manager separately.");
    }
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

  const apiKey = await ensureAuthToken(deps, "mallary.publish");
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
      "profile-id": { type: "string" },
      media: { type: "string", multiple: true },
      thumbnail: { type: "string" },
      comment: { type: "string", multiple: true },
      "scheduled-at": { type: "string" },
      "scheduled-timezone": { type: "string" },
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
      "profile-id",
      "media",
      "thumbnail",
      "comment",
      "scheduled-at",
      "scheduled-timezone",
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
  const thumbnail =
    typeof parsed.values.thumbnail === "string" ? parsed.values.thumbnail.trim() : "";
  if (thumbnail && mediaEntries.length !== 1) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "--thumbnail requires exactly one --media item in flag mode.",
    });
  }
  const mediaInput: unknown[] = thumbnail
    ? [{ url: String(mediaEntries[0]), thumbnail_url: thumbnail }]
    : mediaEntries;
  const resolved = await resolveMediaItems(deps, baseUrl, apiKey, mediaInput);
  const payload: JsonRecord = {
    message,
    platforms,
  };
  if (typeof parsed.values["profile-id"] === "string" && parsed.values["profile-id"].trim()) {
    payload.profile_id = parsed.values["profile-id"].trim();
  }
  if (resolved.mediaPayload.length > 0) payload.media = resolved.mediaPayload;
  if (Array.isArray(parsed.values.comment) && parsed.values.comment.length > 0) {
    payload.comments_under_post = parsed.values.comment;
  }
  if (typeof parsed.values["scheduled-at"] === "string" && parsed.values["scheduled-at"].trim()) {
    payload.scheduled_at = parsed.values["scheduled-at"].trim();
  }
  if (
    typeof parsed.values["scheduled-timezone"] === "string" &&
    parsed.values["scheduled-timezone"].trim()
  ) {
    if (!payload.scheduled_at) {
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_args",
        message: "--scheduled-timezone requires --scheduled-at.",
      });
    }
    payload.scheduled_timezone = parsed.values["scheduled-timezone"].trim();
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
  const apiKey = await ensureAuthToken(deps, "mallary.publish");
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
          for (const line of platformPostIdentityLines(job as JsonRecord)) {
            writeLine(stdout, `  ${line}`);
          }
        }
      });
    }
  });
}

async function runPostsList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "profile-id": { type: "string" },
      page: { type: "string" },
      "per-page": { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["posts", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["posts", "list"])));
  }
  const params = new URLSearchParams();
  if (typeof parsed.values["profile-id"] === "string") params.set("profile_id", parsed.values["profile-id"]);
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
      const actionRequired = extractPostActionRequired(post);
      if (actionRequired?.title || actionRequired?.message) {
        writeLine(
          stdout,
          `  ${String(actionRequired.title || actionRequired.message || "Action required")}`
        );
        if (actionRequired.message && actionRequired.message !== actionRequired.title) {
          writeLine(stdout, `  ${String(actionRequired.message)}`);
        }
      }
      const platformResults = Array.isArray(post.results) ? post.results : [];
      for (const platformResult of platformResults) {
        if (!isObject(platformResult)) continue;
        const identityLines = platformPostIdentityLines(platformResult as JsonRecord);
        if (identityLines.length === 0) continue;
        writeLine(stdout, `  ${formatValue(platformResult.platform)}:`);
        for (const line of identityLines) {
          writeLine(stdout, `    ${line}`);
        }
      }
    });
  });
}

async function runPostsDelete(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.manage");
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

async function runCommentsList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "post-id": { type: "string" },
      platform: { type: "string" },
      "profile-id": { type: "string" },
      limit: { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["comments", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["comments", "list"])));
  }
  const postId = String(parsed.values["post-id"] || parsed.positionals[0] || "").trim();
  if (!postId) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "--post-id is required.",
    });
  }
  const params = new URLSearchParams({ post_id: postId });
  if (typeof parsed.values.platform === "string" && parsed.values.platform.trim()) {
    params.set("platform", parsed.values.platform.trim());
  }
  if (typeof parsed.values["profile-id"] === "string" && parsed.values["profile-id"].trim()) {
    params.set("profile_id", parsed.values["profile-id"].trim());
  }
  if (typeof parsed.values.limit === "string" && parsed.values.limit.trim()) {
    params.set("limit", parsed.values.limit.trim());
  }
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: `/api/v1/comments?${params.toString()}`,
    apiKey,
  });
  return result(response, (stdout) => {
    const data = isObject(response) && isObject(response.data) ? (response.data as JsonRecord) : {};
    const comments = Array.isArray(data.comments) ? data.comments : [];
    writeLine(stdout, `Found ${comments.length} comment(s) on post ${formatValue(data.post_id || postId)}.`);
    comments.forEach((comment) => {
      if (!isObject(comment)) return;
      const author = comment.author_username || comment.author_name || comment.author_id || "unknown";
      writeLine(stdout, `- ${formatValue(comment.id)} | ${formatValue(author)} | ${formatValue(comment.created_at)}`);
      writeLine(stdout, `  ${String(comment.text || "").slice(0, 240)}`);
    });
  });
}

async function runCommentsReply(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.engage");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "post-id": { type: "string" },
      "comment-id": { type: "string" },
      message: { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["comments", "reply"]) }, (stdout) => writeLine(stdout, getHelpText(["comments", "reply"])));
  }
  const postId = String(parsed.values["post-id"] || "").trim();
  const commentId = String(parsed.values["comment-id"] || "").trim();
  const message = String(parsed.values.message || "").trim();
  if (!postId || !commentId || !message) {
    throw new CliError(1, {
      http_status: 0,
      code: "invalid_args",
      message: "--post-id, --comment-id, and --message are required.",
    });
  }
  const body: JsonRecord = {
    post_id: postId,
    comment_id: commentId,
    message,
  };
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/comments/reply",
    apiKey,
    body,
  });
  return result(response, (stdout) => {
    const data = isObject(response) && isObject(response.data) ? (response.data as JsonRecord) : {};
    writeLine(stdout, `Posted reply to comment ${formatValue(data.comment_id || commentId)}.`);
    if (data.reply_id) writeLine(stdout, `Reply ID: ${formatValue(data.reply_id)}`);
    if (data.platform) writeLine(stdout, `Platform: ${formatValue(data.platform)}`);
  });
}

async function runJobGet(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
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
    const actionRequired = extractActionRequired(job.action_required);
    if (actionRequired?.title || actionRequired?.message) {
      writeLine(stdout, `Action: ${formatValue(actionRequired.title || actionRequired.message)}`);
      if (actionRequired.message && actionRequired.message !== actionRequired.title) {
        writeLine(stdout, `Message: ${formatValue(actionRequired.message)}`);
      }
    }
    if (job.error) writeLine(stdout, `Error: ${formatValue(job.error)}`);
    for (const line of platformPostIdentityLines(job)) {
      writeLine(stdout, line);
    }
    if (job.result) {
      writeLine(stdout, "Result:");
      writeLine(stdout, JSON.stringify(job.result, null, 2));
    }
  });
}

async function runJobAttachTikTokUrl(
  deps: CliDeps,
  baseUrl: string,
  args: string[]
): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.publish");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      url: { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result(
      { help: getHelpText(["jobs", "attach-tiktok-url"]) },
      (stdout) => writeLine(stdout, getHelpText(["jobs", "attach-tiktok-url"]))
    );
  }
  const id = parseSinglePositional("id", parsed.positionals[0]);
  const postUrl = String(parsed.values.url || "").trim();
  if (!postUrl) {
    throw new CliError(1, {
      http_status: 0,
      code: "missing_url",
      message: "--url is required.",
    });
  }
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: `/api/v1/jobs/${encodeURIComponent(id)}/tiktok/post-url`,
    apiKey,
    body: {
      post_url: postUrl,
    },
  });
  return result(response, (stdout) => {
    const data =
      isObject(response) && isObject(response.data) ? (response.data as JsonRecord) : null;
    writeLine(stdout, `Updated TikTok job ${formatValue(data?.job_id || id)}.`);
    if (data?.platform_post_id) {
      writeLine(stdout, `Post ID: ${formatValue(data.platform_post_id)}`);
    }
    if (data?.platform_post_url) {
      writeLine(stdout, `Post URL: ${formatValue(data.platform_post_url)}`);
    }
    if (data?.analytics_refresh) {
      writeLine(stdout, "Analytics refresh queued.");
    }
  });
}

async function runAnalyticsList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      "profile-id": { type: "string" },
      "post-id": { type: "string" },
    },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["analytics", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["analytics", "list"])));
  }
  const params = new URLSearchParams();
  if (typeof parsed.values["profile-id"] === "string") params.set("profile_id", parsed.values["profile-id"]);
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

async function runProfilesList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["profiles", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["profiles", "list"])));
  }
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: "/api/v1/profiles",
    apiKey,
  });
  return result(response, (stdout) => {
    const data = isObject(response) && isObject(response.data) ? (response.data as JsonRecord) : null;
    const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
    writeLine(stdout, `Found ${profiles.length} profile(s).`);
    profiles.forEach((profile) => {
      if (!isObject(profile)) return;
      const suffix = profile.is_default ? " (default)" : "";
      const connected = Array.isArray(profile.connected_platforms)
        ? profile.connected_platforms.length
        : 0;
      writeLine(stdout, `- ${formatValue(profile.name)}${suffix} | ID ${formatValue(profile.id)} | ${connected} connected`);
    });
  });
}

async function runWebhooksList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" }, "profile-id": { type: "string" } },
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
  const apiKey = await ensureAuthToken(deps, "mallary.manage");
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
  const apiKey = await ensureAuthToken(deps, "mallary.manage");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" }, "profile-id": { type: "string" } },
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
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" }, "profile-id": { type: "string" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["settings", "get"]) }, (stdout) => writeLine(stdout, getHelpText(["settings", "get"])));
  }
  const params = new URLSearchParams();
  if (typeof parsed.values["profile-id"] === "string") params.set("profile_id", parsed.values["profile-id"]);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: `/api/v1/settings${suffix}`,
    apiKey,
  });
  return result(response, (stdout) => {
    writeLine(stdout, JSON.stringify(response, null, 2));
  });
}

async function runSettingsUpdate(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.manage");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      file: { type: "string" },
      "profile-id": { type: "string" },
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
  if (typeof parsed.values["profile-id"] === "string" && parsed.values["profile-id"].trim()) {
    payload.profile_id = parsed.values["profile-id"].trim();
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
  const apiKey = await ensureAuthToken(deps, "mallary.manage");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" }, "profile-id": { type: "string" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["platforms", "disconnect"]) }, (stdout) => writeLine(stdout, getHelpText(["platforms", "disconnect"])));
  }
  const platform = parseSinglePositional("platform", parsed.positionals[0]).toLowerCase();
  const body: JsonRecord = { platform };
  if (typeof parsed.values["profile-id"] === "string" && parsed.values["profile-id"].trim()) {
    body.profile_id = parsed.values["profile-id"].trim();
  }
  const response = await apiRequest(deps, {
    method: "POST",
    baseUrl,
    requestPath: "/api/v1/disconnect",
    apiKey,
    body,
  });
  return result(response, (stdout) => {
    writeLine(stdout, `Disconnected ${platform}.`);
  });
}

async function runPlatformsList(deps: CliDeps, baseUrl: string, args: string[]): Promise<CommandResult> {
  const apiKey = await ensureAuthToken(deps, "mallary.read");
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { help: { type: "boolean", short: "h" }, "profile-id": { type: "string" } },
  });
  if (parsed.values.help) {
    return result({ help: getHelpText(["platforms", "list"]) }, (stdout) => writeLine(stdout, getHelpText(["platforms", "list"])));
  }
  const params = new URLSearchParams();
  if (typeof parsed.values["profile-id"] === "string") params.set("profile_id", parsed.values["profile-id"]);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(deps, {
    method: "GET",
    baseUrl,
    requestPath: `/api/v1/platforms${suffix}`,
    apiKey,
  });
  return result(response, (stdout) => {
    const data = isObject(response) && isObject(response.data) ? (response.data as JsonRecord) : null;
    const connected = Array.isArray(data?.connected)
      ? data.connected.map((item) => String(item)).filter(Boolean)
      : [];
    const platformRows = Array.isArray(data?.platforms) ? data.platforms : [];
    const supportedCount =
      isObject(data?.counts) && Number.isFinite(Number((data.counts as JsonRecord).supported))
        ? Number((data.counts as JsonRecord).supported)
        : platformRows.length;

    writeLine(stdout, `Connected platforms (${connected.length}/${supportedCount})`);
    if (connected.length === 0) {
      writeLine(stdout, "None");
    } else {
      connected.forEach((platform) => writeLine(stdout, `- ${platform}`));
    }

    if (platformRows.length > 0) {
      writeLine(stdout);
      printHeading(stdout, "All supported platforms");
      platformRows.forEach((item) => {
        if (!isObject(item)) return;
        writeLine(
          stdout,
          `- ${formatValue(item.platform)}: ${item.connected === true ? "connected" : "not connected"}`
        );
      });
    }
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
    case "auth":
      switch (subcommand) {
        case "login":
          return runAuthLogin(deps, rest);
        case "status":
          return runAuthStatus(deps, rest);
        case "logout":
          return runAuthLogout(deps, rest);
        default:
          throw new CliError(1, {
            http_status: 0,
            code: "invalid_command",
            message: "Unknown auth subcommand. Use login, status, or logout.",
          });
      }
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
    case "comments":
      switch (subcommand) {
        case "list":
          return runCommentsList(deps, baseUrl, rest);
        case "reply":
          return runCommentsReply(deps, baseUrl, rest);
        default:
          throw new CliError(1, {
            http_status: 0,
            code: "invalid_command",
            message: "Unknown comments subcommand. Use list or reply.",
          });
      }
    case "jobs":
      if (subcommand === "get") return runJobGet(deps, baseUrl, rest);
      if (subcommand === "attach-tiktok-url") return runJobAttachTikTokUrl(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown jobs subcommand. Use get or attach-tiktok-url.",
      });
    case "analytics":
      if (subcommand === "list") return runAnalyticsList(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown analytics subcommand. Use list.",
      });
    case "profiles":
      if (subcommand === "list") return runProfilesList(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown profiles subcommand. Use list.",
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
      if (subcommand === "list") return runPlatformsList(deps, baseUrl, rest);
      if (subcommand === "disconnect") return runPlatformsDisconnect(deps, baseUrl, rest);
      throw new CliError(1, {
        http_status: 0,
        code: "invalid_command",
        message: "Unknown platforms subcommand. Use list or disconnect.",
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
      : error instanceof OAuthClientError
        ? new CliError(1, {
            http_status:
              typeof error.details?.http_status === "number" ? error.details.http_status : 0,
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          })
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
