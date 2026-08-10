import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const MALLARY_OAUTH_ISSUER = "https://auth.mallary.ai";
export const MALLARY_OAUTH_CLIENT_ID = "mallary-cli";
export const MALLARY_OAUTH_RESOURCE = "https://mallary.ai/mcp";
export const MALLARY_OAUTH_DEVICE_ENDPOINT = `${MALLARY_OAUTH_ISSUER}/device/auth`;
export const MALLARY_OAUTH_TOKEN_ENDPOINT = `${MALLARY_OAUTH_ISSUER}/token`;
export const MALLARY_OAUTH_REVOCATION_ENDPOINT = `${MALLARY_OAUTH_ISSUER}/token/revocation`;

export type MallaryCliOAuthScope =
  | "mallary.read"
  | "mallary.publish"
  | "mallary.engage"
  | "mallary.manage";

const ALL_MALLARY_SCOPES: readonly MallaryCliOAuthScope[] = [
  "mallary.read",
  "mallary.publish",
  "mallary.engage",
  "mallary.manage",
];

export interface OAuthCredentials {
  version: 1;
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  scopes: string[];
  expires_at: number;
  created_at: number;
  updated_at: number;
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresIn: number;
  interval: number;
  scopes: string[];
}

export class OAuthClientError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function boundedSecret(value: unknown, name: string): string {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 16_384 || /[\r\n]/.test(normalized)) {
    throw new OAuthClientError("invalid_oauth_response", `Mallary OAuth returned an invalid ${name}.`);
  }
  return normalized;
}

function positiveInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function tokenScopes(value: unknown, fallback: string[] = []): string[] {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\s+/)
        .filter(Boolean);
  const unique = Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
  return unique.length > 0 ? unique : fallback;
}

function safeOAuthErrorMessage(payload: unknown, fallback: string): string {
  if (!isObject(payload)) return fallback;
  const description = String(payload.error_description || "").trim();
  if (description && description.length <= 500 && !/[\r\n]/.test(description)) return description;
  return fallback;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return isObject(value) ? value : {};
  } catch {
    return {};
  }
}

function formRequest(body: URLSearchParams): RequestInit {
  return {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "mallary-cli",
      "x-mallary-client": "cli",
    },
    body: body.toString(),
  };
}

export function defaultOAuthCredentialPath(
  env: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
  home = os.homedir()
): string {
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Mallary", "credentials.json");
  }
  if (platform === "win32") {
    const appData = String(env.APPDATA || "").trim();
    const root = appData && path.isAbsolute(appData)
      ? appData
      : path.join(home, "AppData", "Roaming");
    return path.join(root, "Mallary", "credentials.json");
  }
  const xdg = String(env.XDG_CONFIG_HOME || "").trim();
  const root = xdg && path.isAbsolute(xdg) ? xdg : path.join(home, ".config");
  return path.join(root, "mallary", "credentials.json");
}

function validateStoredCredentials(value: unknown): OAuthCredentials {
  if (!isObject(value) || value.version !== 1) {
    throw new OAuthClientError(
      "invalid_oauth_credentials",
      "Stored Mallary OAuth credentials are invalid. Run mallary auth login again."
    );
  }
  const accessToken = boundedSecret(value.access_token, "access token");
  const refreshToken = boundedSecret(value.refresh_token, "refresh token");
  const expiresAt = positiveInteger(value.expires_at);
  const createdAt = positiveInteger(value.created_at, Date.now());
  const updatedAt = positiveInteger(value.updated_at, createdAt);
  if (!expiresAt) {
    throw new OAuthClientError(
      "invalid_oauth_credentials",
      "Stored Mallary OAuth credentials are missing their expiration time. Run mallary auth login again."
    );
  }
  return {
    version: 1,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    scopes: tokenScopes(value.scopes),
    expires_at: expiresAt,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function loadOAuthCredentials(filePath: string): Promise<OAuthCredentials | null> {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new OAuthClientError(
        "unsafe_oauth_credentials_file",
        "Mallary refused to read OAuth credentials from a non-regular file."
      );
    }
    if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
      await chmod(filePath, 0o600);
    }
    const raw = await readFile(filePath, "utf8");
    return validateStoredCredentials(JSON.parse(raw));
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof OAuthClientError) throw error;
    throw new OAuthClientError(
      "invalid_oauth_credentials",
      "Mallary could not read the stored OAuth credentials. Run mallary auth login again."
    );
  }
}

export async function saveOAuthCredentials(
  filePath: string,
  credentials: OAuthCredentials
): Promise<void> {
  const normalized = validateStoredCredentials(credentials);
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(directory, 0o700).catch(() => undefined);
  }
  const temporaryPath = `${filePath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    if (process.platform !== "win32") await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, filePath);
    if (process.platform !== "win32") await chmod(filePath, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function removeOAuthCredentials(filePath: string): Promise<boolean> {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new OAuthClientError(
        "unsafe_oauth_credentials_file",
        "Mallary refused to remove OAuth credentials from a non-regular file."
      );
    }
    await unlink(filePath);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export function requestedOAuthScopes(): string[] {
  return ["openid", "offline_access", ...ALL_MALLARY_SCOPES];
}

export async function startDeviceAuthorization(
  fetchImpl: typeof fetch,
  scopes: string[]
): Promise<DeviceAuthorization> {
  const response = await fetchImpl(
    MALLARY_OAUTH_DEVICE_ENDPOINT,
    formRequest(
      new URLSearchParams({
        client_id: MALLARY_OAUTH_CLIENT_ID,
        resource: MALLARY_OAUTH_RESOURCE,
        scope: scopes.join(" "),
      })
    )
  );
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new OAuthClientError(
      "oauth_device_authorization_failed",
      safeOAuthErrorMessage(payload, "Mallary could not start OAuth authorization."),
      { http_status: response.status }
    );
  }
  const deviceCode = boundedSecret(payload.device_code, "device code");
  const userCode = String(payload.user_code || "").trim();
  const verificationUri = String(payload.verification_uri || "").trim();
  const verificationUriComplete = String(payload.verification_uri_complete || "").trim() || null;
  const expiresIn = positiveInteger(payload.expires_in, 600);
  const interval = Math.max(5, positiveInteger(payload.interval, 5));
  if (!userCode || userCode.length > 64 || !verificationUri.startsWith(`${MALLARY_OAUTH_ISSUER}/`)) {
    throw new OAuthClientError(
      "invalid_oauth_response",
      "Mallary OAuth returned invalid device authorization details."
    );
  }
  if (verificationUriComplete && !verificationUriComplete.startsWith(`${MALLARY_OAUTH_ISSUER}/`)) {
    throw new OAuthClientError(
      "invalid_oauth_response",
      "Mallary OAuth returned an invalid verification URL."
    );
  }
  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    expiresIn,
    interval,
    scopes: [...scopes],
  };
}

function credentialsFromTokenResponse(
  payload: Record<string, unknown>,
  now: number,
  existing?: OAuthCredentials,
  fallbackScopes: string[] = []
): OAuthCredentials {
  if (String(payload.token_type || "").trim().toLowerCase() !== "bearer") {
    throw new OAuthClientError(
      "invalid_oauth_response",
      "Mallary OAuth did not return a Bearer access token."
    );
  }
  const accessToken = boundedSecret(payload.access_token, "access token");
  const refreshTokenValue = String(payload.refresh_token || "").trim();
  const refreshToken = refreshTokenValue
    ? boundedSecret(refreshTokenValue, "refresh token")
    : existing?.refresh_token;
  if (!refreshToken) {
    throw new OAuthClientError(
      "oauth_refresh_token_missing",
      "Mallary OAuth did not return a refresh token. Start the login again."
    );
  }
  const expiresIn = positiveInteger(payload.expires_in);
  if (!expiresIn) {
    throw new OAuthClientError(
      "invalid_oauth_response",
      "Mallary OAuth did not return a valid access-token lifetime."
    );
  }
  return {
    version: 1,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    scopes: tokenScopes(payload.scope, existing?.scopes || fallbackScopes),
    expires_at: now + expiresIn * 1000,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

export async function pollForDeviceToken(options: {
  fetchImpl: typeof fetch;
  authorization: DeviceAuthorization;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<OAuthCredentials> {
  const now = options.now || Date.now;
  const sleep = options.sleep || ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + options.authorization.expiresIn * 1000;
  let intervalSeconds = options.authorization.interval;

  while (now() < deadline) {
    await sleep(intervalSeconds * 1000);
    const response = await options.fetchImpl(
      MALLARY_OAUTH_TOKEN_ENDPOINT,
      formRequest(
        new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: options.authorization.deviceCode,
          client_id: MALLARY_OAUTH_CLIENT_ID,
        })
      )
    );
    const payload = await parseJsonResponse(response);
    if (response.ok) {
      return credentialsFromTokenResponse(
        payload,
        now(),
        undefined,
        options.authorization.scopes
      );
    }

    const error = String(payload.error || "").trim();
    if (error === "authorization_pending") continue;
    if (error === "slow_down") {
      intervalSeconds += 5;
      continue;
    }
    if (error === "access_denied") {
      throw new OAuthClientError("oauth_access_denied", "Mallary OAuth access was not approved.");
    }
    if (error === "expired_token") {
      throw new OAuthClientError("oauth_device_code_expired", "The Mallary login code expired. Start again.");
    }
    throw new OAuthClientError(
      "oauth_token_exchange_failed",
      safeOAuthErrorMessage(payload, "Mallary could not complete OAuth authorization."),
      { http_status: response.status }
    );
  }

  throw new OAuthClientError("oauth_device_code_expired", "The Mallary login code expired. Start again.");
}

export async function refreshOAuthCredentials(
  fetchImpl: typeof fetch,
  credentials: OAuthCredentials,
  now = Date.now()
): Promise<OAuthCredentials> {
  const response = await fetchImpl(
    MALLARY_OAUTH_TOKEN_ENDPOINT,
    formRequest(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
        client_id: MALLARY_OAUTH_CLIENT_ID,
        resource: MALLARY_OAUTH_RESOURCE,
      })
    )
  );
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const error = String(payload.error || "").trim();
    throw new OAuthClientError(
      error === "invalid_grant" ? "oauth_reauthentication_required" : "oauth_refresh_failed",
      error === "invalid_grant"
        ? "The Mallary OAuth session expired or was revoked. Run mallary auth login again."
        : safeOAuthErrorMessage(payload, "Mallary could not refresh OAuth access."),
      { http_status: response.status }
    );
  }
  return credentialsFromTokenResponse(payload, now, credentials);
}

export async function revokeOAuthCredentials(
  fetchImpl: typeof fetch,
  credentials: OAuthCredentials
): Promise<void> {
  const response = await fetchImpl(
    MALLARY_OAUTH_REVOCATION_ENDPOINT,
    formRequest(
      new URLSearchParams({
        token: credentials.refresh_token,
        token_type_hint: "refresh_token",
        client_id: MALLARY_OAUTH_CLIENT_ID,
      })
    )
  );
  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    throw new OAuthClientError(
      "oauth_revocation_failed",
      safeOAuthErrorMessage(payload, "Mallary could not revoke the OAuth connection."),
      { http_status: response.status }
    );
  }
}

export function credentialHasScope(
  credentials: OAuthCredentials,
  requiredScope: MallaryCliOAuthScope
): boolean {
  return credentials.scopes.includes(requiredScope);
}
