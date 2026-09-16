import "server-only";
import { randomBytes } from "node:crypto";
import { parseTokens, seal, unseal, type Tokens } from "./oauth-core";

export const oauthEnabled = () => process.env.SMARTTHINGS_AUTH_MODE === "oauth";
const reconnect = "SmartThings 연결을 다시 승인해주세요. 연결 설정에서 삼성 계정으로 연결할 수 있습니다.";
export function oauthConfig() {
  const clientId = process.env.SMARTTHINGS_CLIENT_ID;
  const clientSecret = process.env.SMARTTHINGS_CLIENT_SECRET;
  const key = process.env.SMARTTHINGS_ENCRYPTION_KEY;
  const origin = process.env.APP_ORIGIN;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!clientId || !clientSecret || !key || Buffer.from(key, "base64").length !== 32 || !origin ||
      !redisUrl || !redisToken || (process.env.HOME_ACCESS_KEY?.length ?? 0) < 16) {
    throw new Error("자동 연결을 위한 서버 설정이 아직 완료되지 않았습니다.");
  }
  if (new URL(origin).origin !== origin || (process.env.VERCEL && (!origin.startsWith("https://") || !redisUrl.startsWith("https://")))) {
    throw new Error("서버 주소 설정을 확인해주세요.");
  }
  const oauthBase = !process.env.VERCEL && process.env.SMARTTHINGS_TEST_OAUTH_BASE_URL || "https://api.smartthings.com/oauth";
  return { clientId, clientSecret, key, origin, redisUrl, redisToken, oauthBase,
    redirectUri: `${origin}/api/oauth/callback`, prefix: `ourhome:${clientId}:` };
}
export async function redis(command: (string | number)[]) {
  const { redisUrl, redisToken } = oauthConfig();
  const response = await fetch(redisUrl, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" }, body: JSON.stringify(command) });
  if (!response.ok) throw new Error("연결 정보를 저장하는 서버에 접근하지 못했습니다.");
  const data = await response.json();
  if (data.error) throw new Error("연결 정보 저장에 실패했습니다.");
  return data.result;
}
const tokenKey = () => `${oauthConfig().prefix}tokens`;
export async function readTokens(): Promise<Tokens | null> {
  const value = await redis(["GET", tokenKey()]);
  return value ? unseal<Tokens>(value, oauthConfig().key) : null;
}
export async function exchange(parameters: Record<string, string>, previousId?: string) {
  const config = oauthConfig();
  const response = await fetch(`${config.oauthBase}/token`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ ...parameters, client_id: config.clientId }) });
  // Never expose provider bodies, authorization codes or tokens to logs/browser.
  if (!response.ok) throw new Error(reconnect);
  return parseTokens(await response.json(), previousId);
}
export async function beginState(state: string, browser: string) {
  await redis(["SET", `${oauthConfig().prefix}state:${state}`, browser, "EX", 600, "NX"]);
}
export async function consumeState(state: string, browser: string) {
  const result = await redis(["EVAL", "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1,
    `${oauthConfig().prefix}state:${state}`, browser]);
  return result === 1;
}
export async function accessToken(rejectedToken?: string): Promise<string> {
  if (!oauthEnabled()) {
    if (!process.env.SMARTTHINGS_TOKEN) throw new Error("SmartThings 연결 토큰을 설정해주세요.");
    return process.env.SMARTTHINGS_TOKEN;
  }
  const config = oauthConfig(), lockKey = `${config.prefix}refresh-lock`, pendingKey = `${config.prefix}refresh-pending`;
  const owner = randomBytes(24).toString("hex");
  for (let attempt = 0; attempt < 40; attempt++) {
    const tokens = await readTokens();
    if (!tokens) throw new Error(reconnect);
    if (tokens.expiresAt > Date.now() + 120000 && tokens.accessToken !== rejectedToken) return tokens.accessToken;
    if (await redis(["SET", lockKey, owner, "NX", "PX", 60000]) !== "OK") {
      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }
    try {
      const current = await readTokens();
      if (!current) throw new Error(reconnect);
      if (current.expiresAt > Date.now() + 120000 && current.accessToken !== rejectedToken) return current.accessToken;
      // A previous process may have died after consuming a single-use refresh token.
      // Fail closed instead of replaying it and overwriting a newer connection.
      if (await redis(["GET", pendingKey])) throw new Error(reconnect);
      await redis(["SET", pendingKey, owner]);
      const next = await exchange({ grant_type: "refresh_token", refresh_token: current.refreshToken }, current.installedAppId);
      const saved = await redis(["EVAL", "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]); redis.call('DEL',KEYS[3]); return 1", 3,
        lockKey, tokenKey(), pendingKey, owner, seal(next, config.key)]);
      if (saved !== 1) throw new Error(reconnect);
      return next.accessToken;
    } finally {
      await redis(["EVAL", "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, lockKey, owner]);
    }
  }
  throw new Error("인증 정보를 갱신하고 있습니다. 잠시 후 새로고침해주세요.");
}
export async function saveConnection(tokens: Tokens) {
  const c = oauthConfig();
  // The refresh lock prevents an older in-flight refresh from replacing a new login.
  const owner = randomBytes(24).toString("hex"), lock = `${c.prefix}refresh-lock`;
  if (await redis(["SET", lock, owner, "NX", "PX", 60000]) !== "OK") throw new Error("갱신 중입니다. 잠시 후 다시 연결해주세요.");
  try {
    const saved = await redis(["EVAL", "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]); redis.call('DEL',KEYS[3]); return 1", 3,
      lock, tokenKey(), `${c.prefix}refresh-pending`, owner, seal(tokens, c.key)]);
    if (saved !== 1) throw new Error("연결 저장을 완료하지 못했습니다. 다시 연결해주세요.");
  } finally {
    await redis(["EVAL", "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, lock, owner]);
  }
}
