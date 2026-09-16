import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seal, unseal, session, validSession, parseTokens } from '../smartthings/oauth-core.ts';

test('encrypted token record rejects tampering and wrong key', () => {
  const key = randomBytes(32).toString('base64');
  const data = { accessToken: 'private-access', refreshToken: 'private-refresh' };
  const encrypted = seal(data, key);
  assert.ok(!encrypted.includes('private'));
  assert.deepEqual(unseal(encrypted, key), data);
  assert.throws(() => unseal(encrypted, randomBytes(32).toString('base64')));
  const parts = encrypted.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  assert.throws(() => unseal(parts.join('.'), key));
});
test('household session is signed, expires, and invalidates with password rotation', () => {
  const secret = 'a-long-test-household-password';
  const value = session(secret);
  assert.ok(validSession(value, secret));
  assert.equal(validSession(value, secret + 'changed'), false);
  assert.equal(validSession(value.replace(/^\d+/, '99999999999999'), secret), false);
  assert.equal(validSession(session(secret, Date.now() - 1), secret), false);
  assert.equal(validSession(undefined, secret), false);
});
test('rotated token pair requires complete valid provider response', () => {
  const data = { access_token: 'a', refresh_token: 'r', expires_in: 3600, installed_app_id: 'home' };
  assert.equal(parseTokens(data).installedAppId, 'home');
  assert.equal(parseTokens({ ...data, installed_app_id: undefined }, 'prior').installedAppId, 'prior');
  for (const changes of [{ refresh_token: '' }, { access_token: null }, { expires_in: -1 }, { expires_in: '3600' }, { installed_app_id: '' }]) {
    assert.throws(() => parseTokens({ ...data, ...changes }));
  }
});
