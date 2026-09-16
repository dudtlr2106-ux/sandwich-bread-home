import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number; installedAppId: string };
export function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function seal(value: unknown, key: string) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) throw new Error("연결 암호화 키 설정을 확인해주세요.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", bytes, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString("base64url")).join(".");
}
export function unseal<T>(value: string, key: string): T {
  const [iv, tag, body] = value.split(".").map(s => Buffer.from(s, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8"));
}
export function session(secret: string, expiresAt = Date.now() + 30 * 86400000) {
  const payload = `${expiresAt}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}
export function validSession(value: string | undefined, secret: string | undefined) {
  if (!value || !secret) return false;
  const [expires, nonce, signature, extra] = value.split(".");
  return !extra && Number(expires) > Date.now() && Boolean(nonce && signature) &&
    equal(signature, createHmac("sha256", secret).update(`${expires}.${nonce}`).digest("hex"));
}
export function parseTokens(value: Record<string, unknown>, previousId?: string): Tokens {
  const id = value.installed_app_id ?? previousId;
  if (typeof value.access_token !== "string" || !value.access_token ||
      typeof value.refresh_token !== "string" || !value.refresh_token ||
      typeof value.expires_in !== "number" || !Number.isFinite(value.expires_in) || value.expires_in <= 0 ||
      typeof id !== "string" || !id) throw new Error("SmartThings 인증 응답이 올바르지 않습니다.");
  return { accessToken: value.access_token, refreshToken: value.refresh_token,
    expiresAt: Date.now() + value.expires_in * 1000, installedAppId: id };
}
