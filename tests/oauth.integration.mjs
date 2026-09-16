import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import { seal, unseal } from '../smartthings/oauth-core.ts';

// Two real Next processes share a Redis REST fixture; no actual Samsung credentials.
const values = new Map(), deadlines = new Map();
const get = key => { if ((deadlines.get(key) ?? Infinity) <= Date.now()) { values.delete(key); deadlines.delete(key); } return values.get(key) ?? null; };
const del = key => { deadlines.delete(key); return values.delete(key) ? 1 : 0; };
let exchanges = 0, refreshes = 0, rejectRefresh = false, apiRejectOnce = false;
const key = randomBytes(32).toString('base64'), prefix = 'ourhome:test-client:', origin = 'http://127.0.0.1:3013';
const fixture = createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/redis') {
      assert.equal(req.headers.authorization, 'Bearer test-redis');
      const [command, ...args] = JSON.parse(body); let result;
      if (command === 'GET') result = get(args[0]);
      else if (command === 'DEL') result = del(args[0]);
      else if (command === 'INCR') { result = Number(get(args[0]) ?? 0) + 1; values.set(args[0], result); }
      else if (command === 'EXPIRE') { deadlines.set(args[0], Date.now() + Number(args[1]) * 1000); result = 1; }
      else if (command === 'SET') {
        const [k, value, ...flags] = args;
        result = flags.includes('NX') && get(k) !== null ? null : 'OK';
        if (result) { values.set(k, value); deadlines.delete(k);
          for (const [flag, mult] of [['EX', 1000], ['PX', 1]]) { const i = flags.indexOf(flag); if (i >= 0) deadlines.set(k, Date.now() + flags[i + 1] * mult); }
        }
      } else if (command === 'EVAL') {
        const [script, n, ...rest] = args, keys = rest.slice(0, n), argv = rest.slice(n);
        if (script.includes("~= ARGV[1]")) {
          if (get(keys[0]) !== argv[0]) result = 0;
          else { values.set(keys[1], argv[1]); del(keys[2]); result = 1; }
        } else if (script.includes("== ARGV[1]")) result = get(keys[0]) === argv[0] ? del(keys[0]) : 0;
        else { values.set(keys[0], argv[0]); del(keys[1]); result = 1; }
      } else throw new Error(`Unknown Redis operation ${command}`);
      return res.end(JSON.stringify({ result }));
    }
    if (req.url === '/oauth/token') {
      assert.equal(req.headers.authorization, `Basic ${Buffer.from('test-client:test-secret').toString('base64')}`);
      const params = new URLSearchParams(body);
      if (params.get('grant_type') === 'refresh_token') {
        refreshes++; await delay(300);
        if (rejectRefresh) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid_grant', secret: 'MUST_NOT_LEAK' })); }
      } else { exchanges++; assert.equal(params.get('redirect_uri'), `${origin}/api/oauth/callback`); }
      return res.end(JSON.stringify({ access_token: `access-${refreshes}`, refresh_token: `refresh-${refreshes}`, expires_in: 3600, installed_app_id: 'home-install' }));
    }
    if (req.url.startsWith('/v1/devices')) {
      if (apiRejectOnce) { apiRejectOnce = false; res.statusCode = 401; return res.end('{}'); }
      assert.equal(req.headers.authorization, `Bearer access-${refreshes}`);
      return res.end(JSON.stringify({ items: [] }));
    }
    res.statusCode = 404; res.end('{}');
  } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: error.message })); }
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const fixtureOrigin = `http://127.0.0.1:${fixture.address().port}`;
const env = { ...process.env, IOT_MODE: 'smartthings', SMARTTHINGS_AUTH_MODE: 'oauth', APP_ORIGIN: origin,
  HOME_ACCESS_KEY: 'test-household-password-long', SMARTTHINGS_CLIENT_ID: 'test-client', SMARTTHINGS_CLIENT_SECRET: 'test-secret',
  SMARTTHINGS_ENCRYPTION_KEY: key, UPSTASH_REDIS_REST_URL: `${fixtureOrigin}/redis`, UPSTASH_REDIS_REST_TOKEN: 'test-redis',
  SMARTTHINGS_BASE_URL: `${fixtureOrigin}/v1`, SMARTTHINGS_TEST_OAUTH_BASE_URL: `${fixtureOrigin}/oauth`, SMARTTHINGS_LOCATION_ID: '' };
delete env.VERCEL;
const apps = [3013, 3014].map(port => spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env, stdio: 'ignore' }));
const post = (path, cookie = '', body = '', customOrigin = origin) => fetch(`${origin}${path}`, { method: 'POST', redirect: 'manual',
  headers: { Cookie: cookie, Origin: customOrigin, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
try {
  for (const port of [3013, 3014]) {
    let ready = false;
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/connect`)).ok) { ready = true; break; } } catch {} await delay(250); }
    assert.ok(ready, 'Next server starts');
  }
  assert.equal((await fetch(`${origin}/api/devices`)).status, 401);
  assert.equal((await post('/api/oauth/login', '', 'password=bad', 'https://wrong.example')).status, 403);
  assert.match((await post('/api/oauth/login', '', 'password=bad')).headers.get('location'), /error=login/);
  const login = await post('/api/oauth/login', '', 'password=test-household-password-long');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await post('/api/elevator', cookie, '', 'https://wrong.example')).status, 403);
  const begin = await post('/api/oauth/start', cookie);
  const authorization = new URL(begin.headers.get('location'));
  assert.equal(authorization.searchParams.get('scope'), 'r:devices:* x:devices:* r:locations:*');
  const callback = `${origin}/api/oauth/callback?state=${authorization.searchParams.get('state')}&code=test-code`;
  const absent = await fetch(callback, { redirect: 'manual' });
  assert.match(absent.headers.get('location'), /error=connection/);
  assert.equal(exchanges, 0);
  const accepted = await fetch(callback, { redirect: 'manual', headers: { Cookie: cookie } });
  assert.match(accepted.headers.get('location'), /success=1/);
  assert.equal(exchanges, 1);
  assert.ok(!values.get(`${prefix}tokens`).includes('access-'));
  await fetch(callback, { redirect: 'manual', headers: { Cookie: cookie } });
  assert.equal(exchanges, 1, 'state is single-use');
  const saved = unseal(values.get(`${prefix}tokens`), key);
  values.set(`${prefix}tokens`, seal({ ...saved, expiresAt: 0 }, key));
  const results = await Promise.all([3013, 3014, 3013, 3014].map(port => fetch(`http://127.0.0.1:${port}/api/devices`, { headers: { Cookie: cookie } })));
  for (const response of results) assert.equal(response.status, 200, await response.text());
  assert.equal(refreshes, 1, 'only one cross-process refresh');
  assert.equal(unseal(values.get(`${prefix}tokens`), key).refreshToken, 'refresh-1');
  apiRejectOnce = true;
  assert.equal((await fetch(`${origin}/api/devices`, { headers: { Cookie: cookie } })).status, 200);
  assert.equal(refreshes, 2, '401 refresh and single retry');
  values.set(`${prefix}tokens`, seal({ ...saved, expiresAt: 0 }, key)); rejectRefresh = true;
  const failed = await fetch(`${origin}/api/devices`, { headers: { Cookie: cookie } });
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('MUST_NOT_LEAK'));
  await fetch(`${origin}/api/devices`, { headers: { Cookie: cookie } });
  assert.equal(refreshes, 3, 'uncertain/invalid refresh is never replayed');
  console.log('PASS: OAuth login, CSRF/session/state checks, encrypted storage, two-process refresh, 401 recovery, failed refresh handling.');
} finally {
  for (const app of apps) app.kill();
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
}
