// LIVE INTEGRATION / SECURITY HARNESS. See README.md in this folder.
// Drives a RUNNING API over HTTP + Socket.io and creates users, products and orders in the database behind it.
// It refuses to run unless that database is on this machine and you have opted in explicitly.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
let io; // loaded lazily (after the safety guard) so a missing optional package gives a clear message

const ORIGIN = process.env.API_ORIGIN || 'http://localhost:4000';
const MYSQL = { host: process.env.AUDIT_MYSQL_HOST || '127.0.0.1', port: process.env.AUDIT_MYSQL_PORT || '3306', user: process.env.AUDIT_MYSQL_USER || 'root', db: process.env.AUDIT_MYSQL_DB || '' };
if (process.env.AUDIT_CONFIRM !== 'THIS-DATABASE-IS-DISPOSABLE' || !MYSQL.db || !['127.0.0.1', 'localhost'].includes(MYSQL.host)) {
  console.error('Refusing to run: set AUDIT_MYSQL_DB and AUDIT_CONFIRM=THIS-DATABASE-IS-DISPOSABLE, and use a local database only.');
  process.exit(3);
}
const BASE = `${ORIGIN}/api/v1`;
const PW = 'Test-Passw0rd!x';
const results = [];
let section = '';

const sql = (q) =>
  execFileSync('mysql', ['--no-defaults', `-u${MYSQL.user}`, `-h${MYSQL.host}`, `-P${MYSQL.port}`, '-N', '-B', MYSQL.db, '-e', q], { encoding: 'utf8', env: { ...process.env } }).trim();

function check(id, name, pass, detail = '') {
  results.push({ section, id, name, pass: !!pass, detail: String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? '  :: ' + detail : ''}`);
}
const info = (id, name, detail) => {
  results.push({ section, id, name, pass: null, detail: String(detail) });
  console.log(`INFO ${id} ${name}  :: ${detail}`);
};

async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  let json = null; const text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, body: json, text, headers: res.headers };
}
const D = (r) => r.body?.data;

const users = {};
async function register(key, email, role) {
  const r = await call('POST', '/auth/register', { body: { email, password: PW, firstName: key, lastName: 'Audit', ...(role ? { role } : {}) } });
  users[key] = { email, id: D(r)?.user?.id ?? D(r)?.user?._id, token: D(r)?.accessToken, regStatus: r.status };
  return r;
}
async function login(key) {
  const r = await call('POST', '/auth/login', { body: { email: users[key].email, password: PW } });
  users[key].token = D(r)?.accessToken; return r;
}
const T = (k) => users[k].token;

function sockConnect(auth, headers) {
  return new Promise((resolve) => {
    const s = io(ORIGIN, { auth, transports: ['websocket'], reconnection: false, extraHeaders: headers });
    const done = (v) => resolve({ s, ...v });
    s.on('connect', () => done({ ok: true }));
    s.on('connect_error', (e) => { done({ ok: false, err: e.message }); s.close(); });
    setTimeout(() => done({ ok: false, err: 'timeout' }), 6000);
  });
}
const joinRoom = (s, room) => new Promise((res) => { s.emit('join', room, (r) => res(r)); setTimeout(() => res({ ok: false, error: 'noack' }), 4000); });

const stamp = Date.now().toString(36);
const addr = { street: '1 Test St', city: 'Testville', state: 'TS', country: 'US', zipCode: '12345' };

async function main() {
  try { ({ io } = await import('socket.io-client')); } catch { console.error('Missing dependency: run `npm i --no-save socket.io-client@4` first.'); process.exit(4); }
  // ---------------------------------------------------------------- SETUP
  section = 'SETUP';
  for (const k of ['custA', 'custB', 'custC', 'custD', 'vendA', 'vendB', 'vendP', 'vendS', 'vendN', 'admin', 'super', 'adm2']) {
    await register(k, `${k.toLowerCase()}.${stamp}@audit.test`);
  }
  check('SET-1', 'all 12 audit accounts registered', Object.values(users).every((u) => u.regStatus === 201), Object.values(users).map((u) => u.regStatus).join(','));
  const emails = (ks) => ks.map((k) => `'${users[k].email}'`).join(',');
  sql(`UPDATE users SET role='vendor' WHERE email IN (${emails(['vendA', 'vendB', 'vendP', 'vendS', 'vendN'])})`);
  sql(`UPDATE users SET role='admin' WHERE email IN (${emails(['admin', 'adm2'])})`);
  sql(`UPDATE users SET role='super_admin' WHERE email IN (${emails(['super'])})`);
  const uid = (k) => sql(`SELECT id FROM users WHERE email='${users[k].email}'`);
  for (const k of Object.keys(users)) users[k].id = Number(uid(k));
  const mkVendor = (k, status) => {
    sql(`INSERT INTO vendors (user_id,business_name,slug,email,status,commission_rate,total_sales,total_earnings,pending_payout,rating,review_count,is_verified,created_at,updated_at) VALUES (${users[k].id},'Biz ${k}','biz-${k.toLowerCase()}-${stamp}','${users[k].email}','${status}',10,0,0,0,0,0,0,NOW(),NOW())`);
    const vid = Number(sql(`SELECT id FROM vendors WHERE user_id=${users[k].id}`));
    sql(`UPDATE users SET vendor_id=${vid} WHERE id=${users[k].id}`);
    users[k].vendorId = vid;
  };
  mkVendor('vendA', 'approved'); mkVendor('vendB', 'approved'); mkVendor('vendP', 'pending'); mkVendor('vendS', 'suspended');
  for (const k of Object.keys(users)) await login(k);
  check('SET-2', 'logins after role setup all succeed', Object.values(users).every((u) => !!u.token), '');

  const cats = D(await call('GET', '/products/categories'));
  const catId = cats?.[0]?.id ?? cats?.[0]?._id;
  info('SET-3', 'category used for tests', `id=${catId} of ${cats?.length}`);

  const prodBody = (n, extra = {}) => ({ name: `Audit Product ${n}`, slug: `audit-${String(n).toLowerCase()}-${stamp}`, description: 'Audit product description', sku: `AUD-${n}-${stamp}`, price: 20, categoryId: Number(catId), stock: 50, isActive: true, ...extra });
  const mkProduct = async (who, n, extra) => { const r = await call('POST', '/products', { token: T(who), body: prodBody(n, extra) }); return { r, p: D(r) }; };

  // ---------------------------------------------------------------- A. AUTH / FUNCTIONAL BASICS
  section = 'FUNC-AUTH';
  let r = await register('dupe', users.custA.email);
  check('F-AUTH-1', 'duplicate email registration rejected (409)', r.status === 409, `status ${r.status}`);
  r = await call('POST', '/auth/register', { body: { email: `weak.${stamp}@audit.test`, password: 'short', firstName: 'a', lastName: 'b' } });
  check('F-AUTH-2', 'weak password (<8) rejected 422', r.status === 422, `status ${r.status}`);
  r = await call('POST', '/auth/login', { body: { email: users.custA.email, password: 'wrong-password' } });
  check('F-AUTH-3', 'wrong password -> 401', r.status === 401, `status ${r.status}`);
  r = await call('GET', '/auth/me', { token: T('custA') });
  const meKeys = Object.keys(D(r) ?? {});
  check('F-AUTH-4', 'GET /auth/me returns profile without password hash / tokens', r.status === 200 && !meKeys.some((k) => /^password$|refreshToken|ResetToken|VerificationToken/i.test(k)), `status ${r.status}`);
  const extra = meKeys.filter((k) => /Expires$/.test(k));
  check('F-AUTH-4b', 'GET /auth/me does not expose token-expiry internals', extra.length === 0, `exposed: ${extra.join(',')}`);
  r = await call('GET', '/auth/me');
  check('F-AUTH-5', 'GET /auth/me without token -> 401', r.status === 401, `status ${r.status}`);
  const reg = await register('roleTry', `roletry.${stamp}@audit.test`, 'vendor');
  const roleInDb = sql(`SELECT role FROM users WHERE email='${users.roleTry.email}'`);
  info('F-AUTH-6', 'register with role:"vendor" in body', `HTTP ${reg.status}; role stored = ${roleInDb}`);
  const reg2 = await register('roleTry2', `roletry2.${stamp}@audit.test`, 'admin');
  check('SEC-ESC-1', 'register with role:"admin" does NOT create an admin', sql(`SELECT role FROM users WHERE email='${users.roleTry2.email}'`) === 'customer', `role stored = ${sql(`SELECT role FROM users WHERE email='${users.roleTry2.email}'`)}`);
  r = await call('PATCH', '/auth/me', { token: T('custA'), body: { role: 'admin' } });
  check('SEC-ESC-2', 'PATCH /auth/me {role:"admin"} rejected', r.status === 422 && sql(`SELECT role FROM users WHERE id=${users.custA.id}`) === 'customer', `status ${r.status}`);
  r = await call('PATCH', '/auth/me', { token: T('custA'), body: { firstName: 'Alice', phone: '555-0100' } });
  check('F-AUTH-7', 'PATCH /auth/me updates allowed fields', r.status === 200, `status ${r.status}`);
  r = await call('PATCH', '/auth/me', { token: T('custA'), body: { avatar: 'javascript:alert(1)' } });
  check('SEC-VAL-0', 'avatar javascript: URL rejected', r.status === 422, `status ${r.status}`);

  // refresh / logout
  const lg = await call('POST', '/auth/login', { body: { email: users.custB.email, password: PW } });
  const setCookie = lg.headers.getSetCookie?.() ?? [];
  const refreshCookie = setCookie.find((c) => c.startsWith('refreshToken='))?.split(';')[0].split('=')[1];
  check('F-AUTH-8', 'login sets httpOnly auth cookies', setCookie.length >= 2 && setCookie.every((c) => /HttpOnly/i.test(c)), setCookie.map((c) => c.split(';').slice(1).join(';').trim()).join(' || ').slice(0, 160));
  r = await call('POST', '/auth/refresh', { body: { refreshToken: refreshCookie } });
  check('F-AUTH-9', 'refresh with valid refresh token works', r.status === 200 && !!D(r)?.accessToken, `status ${r.status}`);
  const rr = await call('POST', '/auth/refresh', { body: { refreshToken: refreshCookie } });
  check('F-AUTH-10', 'reusing a rotated refresh token is rejected', rr.status === 401, `status ${rr.status}`);
  r = await call('POST', '/auth/refresh', { body: {} });
  info('F-AUTH-11', 'refresh with no token', `status ${r.status}`);
  await login('custB');

  // ---------------------------------------------------------------- B. SECURITY: authN / forged tokens
  section = 'SEC-AUTHN';
  const forged = (payload, secret = 'not-the-real-secret', alg = 'HS256') => {
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const h = b({ alg, typ: 'JWT' }); const p = b(payload);
    const sig = alg === 'none' ? '' : crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
    return `${h}.${p}.${sig}`;
  };
  const claims = { userId: String(users.admin.id), email: users.admin.email, role: 'super_admin', exp: Math.floor(Date.now() / 1000) + 600 };
  r = await call('GET', '/admin/dashboard', { token: forged(claims) });
  check('SEC-JWT-1', 'JWT signed with wrong secret rejected', r.status === 401, `status ${r.status}`);
  r = await call('GET', '/admin/dashboard', { token: forged(claims, '', 'none') });
  check('SEC-JWT-2', 'alg:none JWT rejected', r.status === 401, `status ${r.status}`);
  r = await call('GET', '/admin/dashboard', { token: 'garbage' });
  check('SEC-JWT-3', 'garbage token rejected', r.status === 401, `status ${r.status}`);
  const expired = forged({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 });
  r = await call('GET', '/admin/dashboard', { token: expired });
  check('SEC-JWT-4', 'expired/forged token rejected', r.status === 401, `status ${r.status}`);
  // a customer's real token with a tampered role claim cannot escalate (role comes from DB)
  const [h0, p0, s0] = T('custA').split('.');
  const p1 = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p0, 'base64url')), role: 'admin' })).toString('base64url');
  r = await call('GET', '/admin/dashboard', { token: `${h0}.${p1}.${s0}` });
  check('SEC-JWT-5', 'tampered role claim in a real token rejected', r.status === 401, `status ${r.status}`);

  // ---------------------------------------------------------------- C. SECURITY: customer vs admin endpoints
  section = 'SEC-RBAC';
  const adminEndpoints = [
    ['GET', '/admin/dashboard'], ['GET', '/admin/analytics/revenue'], ['GET', '/admin/users'], ['GET', '/admin/vendors'],
    ['GET', '/admin/reviews'], ['GET', '/admin/coupons'], ['GET', '/admin/banners'], ['GET', '/orders/admin/all'],
    ['PATCH', `/admin/users/${users.custB.id}`, { isActive: false }], ['PATCH', `/admin/vendors/${users.vendA.vendorId}`, { status: 'suspended' }],
    ['PATCH', '/admin/reviews/1', { isApproved: false }],
    ['POST', '/admin/coupons', { code: 'X', type: 'fixed', value: 5 }], ['POST', '/admin/banners', { title: 'x' }],
  ];
  let bad = [];
  for (const [m, p, b] of adminEndpoints) { const x = await call(m, p, { token: T('custA'), body: b }); if (x.status !== 403) bad.push(`${m} ${p}=${x.status}`); }
  check('SEC-RBAC-1', `customer denied on all ${adminEndpoints.length} admin endpoints (403)`, bad.length === 0, bad.join('; '));
  bad = [];
  for (const [m, p, b] of adminEndpoints) { const x = await call(m, p, { body: b }); if (x.status !== 401) bad.push(`${m} ${p}=${x.status}`); }
  check('SEC-RBAC-2', 'unauthenticated denied on all admin endpoints (401)', bad.length === 0, bad.join('; '));
  bad = [];
  for (const [m, p, b] of adminEndpoints) { const x = await call(m, p, { token: T('vendA'), body: b }); if (x.status !== 403) bad.push(`${m} ${p}=${x.status}`); }
  check('SEC-RBAC-3', 'approved vendor denied on all admin endpoints (403)', bad.length === 0, bad.join('; '));
  check('SEC-RBAC-3b', 'customer/vendor attempts changed nothing (vendor A still approved, custB active)', sql(`SELECT status FROM vendors WHERE id=${users.vendA.vendorId}`) === 'approved' && sql(`SELECT is_active FROM users WHERE id=${users.custB.id}`) === '1', '');
  for (const [k, p] of [['custA', '/vendor/dashboard'], ['custA', '/vendor/products'], ['custA', '/vendor/orders']]) {
    const x = await call('GET', p, { token: T(k) });
    check(`SEC-RBAC-4-${p.split('/')[2]}`, `customer denied on ${p}`, x.status === 403, `status ${x.status}`);
  }
  r = await call('POST', '/products', { token: T('custA'), body: prodBody('cust') });
  check('SEC-RBAC-5', 'customer cannot create a product (403)', r.status === 403, `status ${r.status}`);

  // ---------------------------------------------------------------- D. SECURITY: vendor isolation
  section = 'SEC-VENDOR';
  const { r: cr, p: prodA } = await mkProduct('vendA', 'A1');
  check('SEC-V-0', 'approved vendor A can create product', cr.status === 201 && !!prodA, `status ${cr.status} ${cr.status !== 201 ? cr.text.slice(0, 160) : ''}`);
  const prodAid = Number(prodA?.id ?? prodA?._id);
  check('SEC-V-0b', 'created product is owned by vendor A (vendorId set from DB, not request)', Number(sql(`SELECT vendor_id FROM products WHERE id=${prodAid}`)) === users.vendA.vendorId, `vendor_id=${sql(`SELECT vendor_id FROM products WHERE id=${prodAid}`)}`);
  const before = sql(`SELECT name,price,stock,is_active FROM products WHERE id=${prodAid}`);
  r = await call('PATCH', `/products/${prodAid}`, { token: T('vendB'), body: { name: 'HACKED', price: 0.01 } });
  check('SEC-V-1', "vendor B cannot modify vendor A's product", [403, 404].includes(r.status) && sql(`SELECT name,price,stock,is_active FROM products WHERE id=${prodAid}`) === before, `status ${r.status}`);
  r = await call('DELETE', `/products/${prodAid}`, { token: T('vendB') });
  check('SEC-V-2', "vendor B cannot delete vendor A's product", [403, 404].includes(r.status) && sql(`SELECT is_active FROM products WHERE id=${prodAid}`) === '1', `status ${r.status}`);
  r = await call('PATCH', `/products/${prodAid}`, { token: T('vendA'), body: { vendorId: users.vendB.vendorId } });
  check('SEC-V-3', 'vendor cannot transfer product to another vendor via vendorId', r.status === 422 && Number(sql(`SELECT vendor_id FROM products WHERE id=${prodAid}`)) === users.vendA.vendorId, `status ${r.status}`);
  r = await call('POST', '/products', { token: T('vendA'), body: prodBody('A2', { vendorId: users.vendB.vendorId }) });
  check('SEC-V-4', 'vendor cannot create product under another vendorId', r.status === 422, `status ${r.status}`);
  for (const f of [{ isFeatured: true }, { rating: 5 }, { soldCount: 9999 }, { reviewCount: 500 }, { id: 1 }, { createdAt: '2000-01-01' }]) {
    r = await call('PATCH', `/products/${prodAid}`, { token: T('vendA'), body: f });
    check(`SEC-V-5-${Object.keys(f)[0]}`, `vendor cannot set server-controlled field ${Object.keys(f)[0]}`, r.status === 422, `status ${r.status}`);
  }
  r = await call('PATCH', `/products/${prodAid}`, { token: T('vendA'), body: { price: 25.5, stock: 40 } });
  check('SEC-V-6', 'vendor can update own product (price/stock)', r.status === 200 && Number(sql(`SELECT price FROM products WHERE id=${prodAid}`)) === 25.5, `status ${r.status}`);
  // legacy rows: product without a vendor (vendor_id NULL, e.g. seeded demo data)
  const demoId = Number(sql('SELECT id FROM products WHERE vendor_id IS NULL LIMIT 1'));
  r = await call('PATCH', `/products/${demoId}`, { token: T('vendA'), body: { price: 1 } });
  check('SEC-V-7', 'vendor cannot modify an unowned (vendor_id NULL) catalogue product', [403, 404].includes(r.status) && Number(sql(`SELECT price FROM products WHERE id=${demoId}`)) !== 1, `status ${r.status}`);

  // vendor order isolation
  const pB = (await mkProduct('vendB', 'B1')).p; const prodBid = Number(pB?.id ?? pB?._id);
  const placeOrder = async (who, items, extra = {}) => {
    await call('DELETE', '/cart', { token: T(who) });
    for (const [pid, q] of items) { const a = await call('POST', '/cart/items', { token: T(who), body: { productId: pid, quantity: q } }); if (a.status !== 200 && a.status !== 201) return { err: `cart add ${a.status} ${a.text.slice(0, 120)}` }; }
    const o = await call('POST', '/orders', { token: T(who), body: { shippingAddress: addr, paymentMethod: 'cod', ...extra } });
    return { o, order: D(o) };
  };
  const o1 = await placeOrder('custA', [[prodAid, 2]]);
  const o1id = Number(o1.order?.id ?? o1.order?._id);
  check('SEC-V-8', 'setup: customer order for vendor A product created', o1.o?.status === 201 && o1id > 0, `status ${o1.o?.status} ${o1.err ?? ''}`);
  const statusOf = (id) => sql(`SELECT status FROM orders WHERE id=${id}`);
  r = await call('PATCH', `/orders/${o1id}/status`, { token: T('vendB'), body: { status: 'shipped' } });
  check('SEC-V-9', "vendor B cannot update vendor A's order", [403, 404].includes(r.status) && statusOf(o1id) === 'pending', `status ${r.status}, db status=${statusOf(o1id)}`);
  r = await call('PATCH', `/orders/${o1id}/status`, { token: T('custA'), body: { status: 'delivered' } });
  check('SEC-V-10', 'customer cannot set order status', r.status === 403 && statusOf(o1id) === 'pending', `status ${r.status}`);
  r = await call('PATCH', `/orders/${o1id}/status`, { token: T('vendA'), body: { status: 'refunded' } });
  check('SEC-V-11', "vendor cannot set 'refunded'", r.status === 403 && statusOf(o1id) === 'pending', `status ${r.status}`);
  r = await call('PATCH', `/orders/${o1id}/status`, { token: T('vendA'), body: { status: 'confirmed', note: 'ok' } });
  check('SEC-V-12', "vendor A CAN update own order", r.status === 200 && statusOf(o1id) === 'confirmed', `status ${r.status}`);
  const o2 = await placeOrder('custA', [[prodAid, 1], [prodBid, 1]]);
  const o2id = Number(o2.order?.id ?? o2.order?._id);
  r = await call('PATCH', `/orders/${o2id}/status`, { token: T('vendA'), body: { status: 'shipped' } });
  check('SEC-V-13', 'vendor cannot change a mixed-vendor order', r.status === 403 && statusOf(o2id) === 'pending', `status ${r.status}`);
  r = await call('GET', `/orders/${o1id}`, { token: T('custB') });
  check('SEC-V-14', "customer B cannot read customer A's order (IDOR)", r.status === 404, `status ${r.status}`);
  r = await call('GET', `/orders/${o1id}`, { token: T('vendB') });
  check('SEC-V-15', "vendor B cannot read customer A's order by id", [403, 404].includes(r.status), `status ${r.status}`);
  r = await call('GET', '/vendor/orders', { token: T('vendB') });
  const leaked = (D(r) ?? []).some((o) => Number(o.id) === o1id);
  check('SEC-V-16', "vendor B's /vendor/orders does not list vendor A's order", r.status === 200 && !leaked, `status ${r.status}, leaked=${leaked}`);
  r = await call('GET', '/vendor/orders', { token: T('vendA') });
  const itemsOnlyMine = (D(r) ?? []).every((o) => (o.items ?? []).every((i) => Number(i.vendorId) === users.vendA.vendorId));
  check('SEC-V-17', "vendor A's /vendor/orders shows only vendor A's line items in mixed orders", r.status === 200 && itemsOnlyMine, `status ${r.status}`);

  // ---------------------------------------------------------------- E. SECURITY: vendor without approved profile
  section = 'SEC-VENDOR-STATUS';
  for (const k of ['vendP', 'vendS', 'vendN']) {
    const label = { vendP: 'pending', vendS: 'suspended', vendN: 'no-profile' }[k];
    r = await call('POST', '/products', { token: T(k), body: prodBody(`x${k}`) });
    check(`SEC-VS-${label}-create`, `${label} vendor cannot create products`, r.status === 403, `status ${r.status}`);
    r = await call('PATCH', `/products/${prodAid}`, { token: T(k), body: { price: 1 } });
    check(`SEC-VS-${label}-patch`, `${label} vendor cannot patch products`, r.status === 403, `status ${r.status}`);
    r = await call('DELETE', `/products/${prodAid}`, { token: T(k) });
    check(`SEC-VS-${label}-delete`, `${label} vendor cannot delete products`, r.status === 403, `status ${r.status}`);
    r = await call('PATCH', `/orders/${o2id}/status`, { token: T(k), body: { status: 'shipped' } });
    check(`SEC-VS-${label}-order`, `${label} vendor cannot update order status`, r.status === 403, `status ${r.status}`);
  }
  for (const k of ['vendP', 'vendS', 'vendN']) {
    const label = { vendP: 'pending', vendS: 'suspended', vendN: 'no-profile' }[k];
    for (const p of ['/vendor/dashboard', '/vendor/products', '/vendor/orders']) {
      r = await call('GET', p, { token: T(k) });
      check(`SEC-VS-${label}-read-${p.split('/')[2]}`, `${label} vendor denied READ on ${p}`, r.status === 403, `status ${r.status}${r.status === 200 ? ' (data returned: ' + r.text.length + ' bytes)' : ''}`);
    }
  }
  // suspended vendor with prior sales: does the read API expose customer PII?
  sql(`UPDATE order_items SET vendor_id=${users.vendS.vendorId} WHERE order_id=${o1id}`);
  r = await call('GET', '/vendor/orders', { token: T('vendS') });
  const pii = JSON.stringify(D(r) ?? []);
  info('SEC-VS-pii', 'suspended vendor GET /vendor/orders exposes customer email?', `status ${r.status}; contains customer email=${pii.includes(users.custA.email)}`);
  sql(`UPDATE order_items SET vendor_id=${users.vendA.vendorId} WHERE order_id=${o1id}`);

  // onboarding path
  r = await call('POST', '/vendor/onboard', { token: T('custA'), body: { businessName: 'Cust Biz', email: 'x@y.test' } });
  check('F-VEND-1', 'customer cannot self-onboard as vendor (403)', r.status === 403, `status ${r.status}`);
  r = await call('POST', '/vendor/onboard', { token: T('vendN'), body: { businessName: `Onboard Biz ${stamp}`, email: users.vendN.email, description: 'x', address: { street: 'a', city: 'b', state: 'c', country: 'd', zipCode: 'e' } } });
  check('F-VEND-2', 'vendor-role user without profile can onboard (creates pending profile)', r.status === 201 && sql(`SELECT status FROM vendors WHERE user_id=${users.vendN.id}`) === 'pending', `status ${r.status} ${r.status !== 201 ? r.text.slice(0, 150) : ''}`);
  r = await call('POST', '/products', { token: T('vendN'), body: prodBody('N1') });
  check('F-VEND-3', 'newly onboarded (pending) vendor still cannot create products', r.status === 403, `status ${r.status}`);
  const newVid = Number(sql(`SELECT id FROM vendors WHERE user_id=${users.vendN.id}`));
  r = await call('PATCH', `/admin/vendors/${newVid}`, { token: T('admin'), body: { status: 'approved' } });
  check('F-VEND-4', 'admin can approve vendor', r.status === 200 && sql(`SELECT status FROM vendors WHERE id=${newVid}`) === 'approved', `status ${r.status}`);
  r = await call('POST', '/products', { token: T('vendN'), body: prodBody('N2') });
  check('F-VEND-5', 'approved vendor can now create products', r.status === 201, `status ${r.status}`);
  r = await call('PATCH', `/admin/vendors/${newVid}`, { token: T('admin'), body: { status: 'suspended' } });
  r = await call('POST', '/products', { token: T('vendN'), body: prodBody('N3') });
  check('F-VEND-6', 'suspending a vendor immediately blocks product creation', r.status === 403, `status ${r.status}`);

  // ---------------------------------------------------------------- F. SECURITY: product field validation
  section = 'SEC-VALIDATION';
  const vcase = async (id, name, extra, expect = 422) => {
    const x = await call('POST', '/products', { token: T('vendA'), body: { ...prodBody(`v${id}`), ...extra } });
    check(`SEC-VAL-${id}`, name, x.status === expect, `status ${x.status}${x.status === 500 ? ' ' + x.text.slice(0, 100) : ''}`);
    return x;
  };
  await vcase('neg-price', 'negative price rejected', { price: -5 });
  await vcase('zero-price', 'zero price rejected', { price: 0 });
  await vcase('str-price', 'non-numeric price rejected', { price: 'abc' });
  await vcase('huge-price', 'price above max rejected', { price: 1e12 });
  await vcase('nan-price', 'null price rejected', { price: null });
  await vcase('neg-stock', 'negative stock rejected', { stock: -1 });
  await vcase('frac-stock', 'fractional stock rejected', { stock: 1.5 });
  await vcase('huge-stock', 'stock above max rejected', { stock: 99999999 });
  await vcase('bad-slug', 'slug with spaces/uppercase/unicode rejected', { slug: 'Bad Slug!' });
  await vcase('empty-name', 'empty name rejected', { name: '   ' });
  await vcase('long-name', 'name > 255 chars rejected', { name: 'x'.repeat(300) });
  await vcase('js-image', 'javascript: image URL rejected', { images: [{ url: 'javascript:alert(1)' }] });
  await vcase('data-image', 'data: image URL rejected', { images: [{ url: 'data:text/html,<script>1</script>' }] });
  await vcase('many-images', '>20 images rejected', { images: Array.from({ length: 21 }, () => ({ url: 'https://example.com/a.png' })) });
  await vcase('unknown-field', 'unknown field rejected (strict)', { __proto__x: 1, isAdmin: true });
  await vcase('cat-string', 'non-numeric categoryId rejected', { categoryId: 'abc' });
  const noCat = await vcase('cat-missing', 'nonexistent categoryId handled (no 500)', { categoryId: 999999 }, null);
  check('SEC-VAL-cat-missing-b', 'nonexistent categoryId returns a 4xx, not 500', noCat.status >= 400 && noCat.status < 500, `status ${noCat.status}`);
  const dup = await call('POST', '/products', { token: T('vendA'), body: prodBody('A1') });
  check('SEC-VAL-dup-slug', 'duplicate slug/sku returns 409/422, not 500', [409, 422].includes(dup.status), `status ${dup.status}`);
  r = await call('POST', '/products', { token: T('vendA'), body: { ...prodBody('xss'), name: '<img src=x onerror=alert(1)>' } });
  info('SEC-VAL-xss', 'HTML in product name is stored as plain text (React escapes on render)', `status ${r.status}`);
  const big = await call('POST', '/products', { token: T('vendA'), body: { ...prodBody('bigdesc'), description: 'x'.repeat(20001) } });
  check('SEC-VAL-big-desc', 'description > 20000 chars rejected', big.status === 422, `status ${big.status}`);
  r = await call('POST', '/products', { token: T('vendA'), body: prodBody('ok1', { images: [{ url: 'https://example.com/a.png', isPrimary: true }], tags: ['a', 'b'], variants: [{ name: 'Size', options: ['S', 'M'] }] }) });
  check('SEC-VAL-valid', 'fully valid product accepted', r.status === 201, `status ${r.status} ${r.status !== 201 ? r.text.slice(0, 150) : ''}`);
  r = await call('PATCH', `/products/abc`, { token: T('vendA'), body: { price: 5 } });
  check('SEC-VAL-bad-id', 'PATCH /products/abc returns 4xx, not 500', r.status >= 400 && r.status < 500, `status ${r.status}`);
  r = await call('PATCH', `/products/${prodAid}`, { token: T('vendA'), body: {} });
  check('SEC-VAL-empty-patch', 'empty PATCH body rejected', r.status === 422, `status ${r.status}`);

  // ---------------------------------------------------------------- G. SECURITY: admin permissions
  section = 'SEC-ADMIN';
  r = await call('GET', '/admin/dashboard', { token: T('admin') });
  check('SEC-A-1', 'admin can read dashboard', r.status === 200, `status ${r.status}`);
  r = await call('GET', '/admin/users', { token: T('admin') });
  const leakFields = JSON.stringify(D(r) ?? []);
  check('SEC-A-2', 'admin user list works and exposes no password/token fields', r.status === 200 && !/password|refreshToken|ResetToken|VerificationToken/i.test(leakFields), `status ${r.status}`);
  r = await call('PATCH', `/admin/users/${users.admin.id}`, { token: T('admin'), body: { isActive: false } });
  check('SEC-A-3', 'admin cannot deactivate self', r.status === 400, `status ${r.status}`);
  r = await call('PATCH', `/admin/users/${users.adm2.id}`, { token: T('admin'), body: { isActive: false } });
  check('SEC-A-4', 'admin cannot deactivate another admin', r.status === 403 && sql(`SELECT is_active FROM users WHERE id=${users.adm2.id}`) === '1', `status ${r.status}`);
  r = await call('PATCH', `/admin/users/${users.super.id}`, { token: T('admin'), body: { isActive: false } });
  check('SEC-A-5', 'admin cannot deactivate super_admin', r.status === 403 && sql(`SELECT is_active FROM users WHERE id=${users.super.id}`) === '1', `status ${r.status}`);
  r = await call('PATCH', `/admin/users/${users.custD.id}`, { token: T('admin'), body: { isActive: false } });
  check('SEC-A-6', 'admin can deactivate a customer', r.status === 200 && sql(`SELECT is_active FROM users WHERE id=${users.custD.id}`) === '0', `status ${r.status}`);
  r = await call('GET', '/auth/me', { token: T('custD') });
  check('SEC-A-7', "deactivated user's existing access token stops working immediately", r.status === 401, `status ${r.status}`);
  r = await call('POST', '/auth/login', { body: { email: users.custD.email, password: PW } });
  check('SEC-A-8', 'deactivated user cannot log in', r.status === 403, `status ${r.status}`);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: 'x' } });
  r = await call('PATCH', `/admin/users/${users.adm2.id}`, { token: T('super'), body: { isActive: false } });
  check('SEC-A-9', 'super_admin can deactivate an admin', r.status === 200, `status ${r.status}`);
  await call('PATCH', `/admin/users/${users.adm2.id}`, { token: T('super'), body: { isActive: true } });
  await call('PATCH', `/admin/users/${users.custD.id}`, { token: T('admin'), body: { isActive: true } });
  r = await call('PATCH', `/admin/users/${users.custB.id}`, { token: T('admin'), body: { isActive: false, role: 'super_admin' } });
  check('SEC-A-10', 'admin user PATCH cannot smuggle a role change', sql(`SELECT role FROM users WHERE id=${users.custB.id}`) === 'customer', `status ${r.status}, role=${sql(`SELECT role FROM users WHERE id=${users.custB.id}`)}`);
  await call('PATCH', `/admin/users/${users.custB.id}`, { token: T('admin'), body: { isActive: true } });
  const ap = await call('POST', '/products', { token: T('admin'), body: prodBody('adm', { isFeatured: true, vendorId: users.vendB.vendorId }) });
  check('SEC-A-11', 'admin can create product with isFeatured/vendorId', ap.status === 201, `status ${ap.status} ${ap.status !== 201 ? ap.text.slice(0, 120) : ''}`);
  r = await call('GET', '/orders/admin/all', { token: T('admin') });
  check('SEC-A-12', 'admin can list all orders', r.status === 200, `status ${r.status}`);
  r = await call('PATCH', `/orders/${o2id}/status`, { token: T('admin'), body: { status: 'refunded' } });
  check('SEC-A-13', 'admin can set any status incl. refunded on mixed order', r.status === 200, `status ${r.status}`);
  r = await call('PATCH', `/admin/vendors/${users.vendA.vendorId}`, { token: T('admin'), body: { status: 'bogus' } });
  check('SEC-A-14', 'invalid vendor status rejected', r.status === 422, `status ${r.status}`);

  // ---------------------------------------------------------------- H. SECURITY: sockets
  section = 'SEC-SOCKET';
  let c = await sockConnect({});
  check('SEC-S-1', 'unauthenticated socket rejected', !c.ok, c.err ?? 'CONNECTED'); c.s.close();
  c = await sockConnect({ token: 'garbage' });
  check('SEC-S-2', 'garbage-token socket rejected', !c.ok, c.err ?? 'CONNECTED'); c.s.close();
  c = await sockConnect({ token: forged({ userId: String(users.admin.id), role: 'admin', exp: Math.floor(Date.now() / 1000) + 600 }) });
  check('SEC-S-3', 'forged-token socket rejected', !c.ok, c.err ?? 'CONNECTED'); c.s.close();
  const tokenRes = await call('GET', '/auth/socket-token', { token: T('custA') });
  const stoken = D(tokenRes)?.token ?? D(tokenRes)?.socketToken ?? D(tokenRes)?.accessToken;
  check('SEC-S-4', 'GET /auth/socket-token issues a dedicated token', tokenRes.status === 200 && !!stoken && stoken !== T('custA'), `status ${tokenRes.status} keys=${Object.keys(D(tokenRes) ?? {})}`);
  r = await call('GET', '/auth/me', { token: stoken });
  check('SEC-S-5', 'socket token cannot be used as API access token', r.status === 401, `status ${r.status}`);
  const cA = await sockConnect({ token: stoken });
  check('SEC-S-6', 'customer A connects with socket token', cA.ok, cA.err ?? '');
  let j = await joinRoom(cA.s, `user:${users.custA.id}`);
  check('SEC-S-7', 'customer A can join own user room', j.ok === true, JSON.stringify(j));
  j = await joinRoom(cA.s, `user:${users.custB.id}`);
  check('SEC-S-8', "customer A cannot join customer B's room", j.ok === false, JSON.stringify(j));
  j = await joinRoom(cA.s, 'admin');
  check('SEC-S-9', 'customer cannot join admin room', j.ok === false, JSON.stringify(j));
  j = await joinRoom(cA.s, `vendor:${users.vendA.vendorId}`);
  check('SEC-S-10', 'customer cannot join a vendor room', j.ok === false, JSON.stringify(j));
  for (const bad of ['user:*', 'user:1 OR 1', 'user:0', '', null, { a: 1 }, 'user:' + users.custA.id + '\n', 'USER:' + users.custA.id, 'user:' + '9'.repeat(30)]) {
    j = await joinRoom(cA.s, bad);
    if (j.ok !== false) check('SEC-S-11', `malformed room ${JSON.stringify(bad)} rejected`, false, JSON.stringify(j));
  }
  check('SEC-S-11', 'malformed/odd room names all rejected', !results.some((x) => x.id === 'SEC-S-11' && !x.pass), '');
  cA.s.close();
  const cAcookie = await sockConnect({}, { Cookie: `accessToken=${T('custA')}` });
  check('SEC-S-12', 'socket accepts access-token cookie (same-origin deployments)', cAcookie.ok, cAcookie.err ?? ''); cAcookie.s.close();
  const cAcc = await sockConnect({ token: T('custA') });
  check('SEC-S-12b', 'socket accepts a normal access token', cAcc.ok, cAcc.err ?? ''); cAcc.s.close();
  const refreshAsSocket = await sockConnect({ token: refreshCookie });
  check('SEC-S-13', 'refresh token cannot be used to open a socket', !refreshAsSocket.ok, refreshAsSocket.err ?? 'CONNECTED'); refreshAsSocket.s.close();
  const vA = await sockConnect({ token: T('vendA') });
  j = await joinRoom(vA.s, `vendor:${users.vendA.vendorId}`);
  check('SEC-S-14', 'approved vendor A can join own vendor room', j.ok === true, JSON.stringify(j));
  j = await joinRoom(vA.s, `vendor:${users.vendB.vendorId}`);
  check('SEC-S-15', "vendor A cannot join vendor B's room", j.ok === false, JSON.stringify(j));
  j = await joinRoom(vA.s, 'admin');
  check('SEC-S-16', 'vendor cannot join admin room', j.ok === false, JSON.stringify(j));
  vA.s.close();
  const vP = await sockConnect({ token: T('vendP') });
  j = await joinRoom(vP.s, `vendor:${users.vendP.vendorId}`);
  check('SEC-S-17', 'pending vendor cannot join its own vendor room', j.ok === false, JSON.stringify(j)); vP.s.close();
  const aS = await sockConnect({ token: T('admin') });
  j = await joinRoom(aS.s, 'admin');
  check('SEC-S-18', 'admin can join admin room', j.ok === true, JSON.stringify(j));
  j = await joinRoom(aS.s, `user:${users.custA.id}`);
  check('SEC-S-19', "admin cannot join an arbitrary customer's private room", j.ok === false, JSON.stringify(j)); aS.s.close();
  // suspension takes effect on an open socket
  const cB = await sockConnect({ token: T('custB') });
  await call('PATCH', `/admin/users/${users.custB.id}`, { token: T('admin'), body: { isActive: false } });
  j = await joinRoom(cB.s, `user:${users.custB.id}`);
  check('SEC-S-20', 'deactivating a user blocks further room joins on an open socket', j.ok === false, JSON.stringify(j));
  await call('PATCH', `/admin/users/${users.custB.id}`, { token: T('admin'), body: { isActive: true } }); cB.s.close();
  let roomsJoined = 0; const cM = await sockConnect({ token: T('custA') });
  for (let i = 0; i < 3; i++) { j = await joinRoom(cM.s, `user:${users.custA.id}`); if (j.ok) roomsJoined++; }
  info('SEC-S-21', 'repeated joins of the same room', `${roomsJoined}/3 acked ok`); cM.s.close();
  // does the server actually EMIT order events to rooms? (grep-level fact checked separately)


  // ================================================================ PART 2: FUNCTIONAL
  section = 'FUNC-CATALOG';
  const price = (o) => Number(o.price);
  r = await call('GET', '/products?limit=100');
  const plist = D(r)?.products ?? D(r);
  check('F-CAT-1', 'GET /products lists active products with pagination meta', r.status === 200 && Array.isArray(plist) && plist.length > 0 && !!r.body?.meta, `status ${r.status}, n=${plist?.length}, meta=${JSON.stringify(r.body?.meta)?.slice(0, 80)}`);
  r = await call('GET', '/products?limit=2&page=1');
  check('F-CAT-2', 'pagination: limit=2 returns <=2 items with hasNext', (D(r)?.products ?? D(r))?.length === 2 && r.body?.meta?.hasNext === true, JSON.stringify(r.body?.meta));
  r = await call('GET', `/products/${`audit-a1-${stamp}`}`);
  check('F-CAT-3', 'GET /products/:slug returns product details', r.status === 200 && (D(r)?.name ?? '').includes('A1'), `status ${r.status}`);
  r = await call('GET', '/products/does-not-exist-xyz');
  check('F-CAT-4', 'unknown slug -> 404', r.status === 404, `status ${r.status}`);
  const inactiveSlug = `audit-inactive-${stamp}`;
  await mkProduct('vendA', 'inactive', { slug: inactiveSlug, isActive: false });
  r = await call('GET', `/products/${inactiveSlug}`);
  check('F-CAT-5', 'inactive product is not publicly visible (404)', r.status === 404, `status ${r.status}`);
  r = await call('GET', '/products/categories');
  check('F-CAT-6', 'categories endpoint works', r.status === 200 && (D(r)?.length ?? 0) > 0, `n=${D(r)?.length}`);
  r = await call('GET', '/products/featured');
  check('F-CAT-7', 'featured endpoint works', r.status === 200, `status ${r.status}`);
  section = 'FUNC-SEARCH';
  r = await call('GET', `/products?search=${encodeURIComponent('Audit Product A1')}`);
  check('F-SRCH-1', 'search by name finds the product', (D(r)?.products ?? D(r) ?? []).some((p) => (p.name ?? '').includes('A1')), `status ${r.status}`);
  r = await call('GET', '/products?search=zzzzqqqq-no-match');
  check('F-SRCH-2', 'search with no match returns empty list', r.status === 200 && (D(r)?.products ?? D(r) ?? []).length === 0, `status ${r.status}`);
  r = await call('GET', `/products?search=${encodeURIComponent("' OR '1'='1")}`);
  check('F-SRCH-3', "SQL-injection-style search string is inert (200, no rows)", r.status === 200 && (D(r)?.products ?? D(r) ?? []).length === 0, `status ${r.status}`);
  r = await call('GET', `/products?category=${catId}&limit=100`);
  const catOk = (D(r)?.products ?? D(r) ?? []).every((p) => Number(p.categoryId ?? p.category?.id) === Number(catId));
  check('F-SRCH-4', 'category filter returns only that category', r.status === 200 && catOk, `status ${r.status}`);
  r = await call('GET', '/products?minPrice=15&maxPrice=30&limit=100');
  check('F-SRCH-5', 'price range filter respected', (D(r)?.products ?? D(r) ?? []).every((p) => price(p) >= 15 && price(p) <= 30), `status ${r.status}`);
  r = await call('GET', '/products?sort=price-asc&limit=100');
  const asc = (D(r)?.products ?? D(r) ?? []).map(price); check('F-SRCH-6', 'sort=price-asc is ordered', asc.every((v, i) => i === 0 || asc[i - 1] <= v) && asc.length > 1, `n=${asc.length}`);
  r = await call('GET', '/products?sort=price-desc&limit=100');
  const desc = (D(r)?.products ?? D(r) ?? []).map(price); check('F-SRCH-7', 'sort=price-desc is ordered', desc.every((v, i) => i === 0 || desc[i - 1] >= v) && desc.length > 1, `n=${desc.length}`);
  for (const q of ['page=-1', 'page=abc', 'limit=-5', 'limit=abc', 'limit=100000', 'minPrice=abc', 'maxPrice=-1', 'search[a]=b', 'category[a]=b', 'sort=zzz', 'vendor=abc', 'featured=maybe']) {
    const x = await call('GET', `/products?${q}`);
    check(`F-ROBUST-${q}`, `GET /products?${q} does not 500`, x.status < 500, `status ${x.status}`);
  }

  section = 'FUNC-CART';
  r = await call('GET', '/cart'); check('F-CART-0', 'cart requires auth', r.status === 401, `status ${r.status}`);
  await call('DELETE', '/cart', { token: T('custC') });
  r = await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: 1 } });
  check('F-CART-1', 'add item to cart', [200, 201].includes(r.status), `status ${r.status}`);
  r = await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: 2 } });
  r = await call('GET', '/cart', { token: T('custC') });
  check('F-CART-2', 'adding the same product increments quantity (1+2=3)', D(r)?.items?.length === 1 && D(r).items[0].quantity === 3, `items=${D(r)?.items?.length}, qty=${D(r)?.items?.[0]?.quantity}`);
  r = await call('PATCH', `/cart/items/${prodAid}`, { token: T('custC'), body: { quantity: 5 } });
  check('F-CART-3', 'update quantity to 5', r.status === 200 && D(r)?.items?.[0]?.quantity === 5, `status ${r.status}`);
  r = await call('GET', '/cart', { token: T('custA') });
  check('F-CART-4', "customer A's cart is isolated from customer C's", !(D(r)?.items ?? []).some((i) => i.quantity === 5), '');
  for (const [lbl, q] of [['zero', 0], ['negative', -1], ['fractional', 1.5], ['over-max', 101], ['string', 'abc']]) {
    const x = await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: q } });
    check(`F-CART-qty-${lbl}`, `add quantity ${JSON.stringify(q)} rejected`, x.status === 422, `status ${x.status}`);
  }
  r = await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: 100 } });
  check('F-CART-5', 'adding more than stock is rejected (400)', r.status === 400, `status ${r.status}`);
  r = await call('POST', '/cart/items', { token: T('custC'), body: { productId: 99999999, quantity: 1 } });
  check('F-CART-6', 'nonexistent product -> 404', r.status === 404, `status ${r.status}`);
  r = await call('PATCH', `/cart/items/${prodAid}`, { token: T('custC'), body: { quantity: 0 } });
  r = await call('GET', '/cart', { token: T('custC') });
  check('F-CART-7', 'quantity 0 removes the item', (D(r)?.items ?? []).length === 0, `items=${D(r)?.items?.length}`);
  await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: 1 } });
  r = await call('DELETE', `/cart/items/${prodAid}`, { token: T('custC') });
  r = await call('GET', '/cart', { token: T('custC') });
  check('F-CART-8', 'remove item works', (D(r)?.items ?? []).length === 0, '');
  await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: 1 } });
  r = await call('DELETE', '/cart', { token: T('custC') });
  r = await call('GET', '/cart', { token: T('custC') });
  check('F-CART-9', 'clear cart works', (D(r)?.items ?? []).length === 0, '');

  section = 'FUNC-CHECKOUT';
  await call('DELETE', '/cart', { token: T('custC') });
  r = await call('POST', '/orders', { token: T('custC'), body: { shippingAddress: addr, paymentMethod: 'cod' } });
  check('F-CHK-1', 'checkout with empty cart -> 400', r.status === 400, `status ${r.status}`);
  const stock0 = Number(sql(`SELECT stock FROM products WHERE id=${prodAid}`));
  const cur = Number(sql(`SELECT price FROM products WHERE id=${prodAid}`));
  const co = await placeOrder('custC', [[prodAid, 2]]);
  const ord = co.order; const sub = cur * 2, tax = sub * 0.08, ship = sub > 100 ? 0 : 9.99;
  check('F-CHK-2', 'order created (201) with pending status', co.o?.status === 201 && ord?.status === 'pending', `status ${co.o?.status} ${co.err ?? ''}`);
  const near = (a, b) => Math.abs(Number(a) - b) < 0.011;
  check('F-CHK-3', `totals correct: subtotal ${sub}, tax ${tax.toFixed(2)}, shipping ${ship}`, near(ord?.subtotal, sub) && near(ord?.tax, tax) && near(ord?.shipping, ship) && near(ord?.total, sub + tax + ship), `got sub=${ord?.subtotal} tax=${ord?.tax} ship=${ord?.shipping} total=${ord?.total}`);
  check('F-CHK-4', 'stock decremented by ordered quantity', Number(sql(`SELECT stock FROM products WHERE id=${prodAid}`)) === stock0 - 2, `before ${stock0} after ${sql(`SELECT stock FROM products WHERE id=${prodAid}`)}`);
  r = await call('GET', '/cart', { token: T('custC') });
  check('F-CHK-5', 'cart emptied after checkout', (D(r)?.items ?? []).length === 0, '');
  check('F-CHK-6', 'order has status-history row, paymentStatus pending', Number(sql(`SELECT COUNT(*) FROM order_status_history WHERE order_id=${ord?.id}`)) >= 1 && sql(`SELECT payment_status FROM orders WHERE id=${ord?.id}`) === 'pending', '');
  await call('POST', '/cart/items', { token: T('custC'), body: { productId: prodAid, quantity: 1 } });
  r = await call('POST', '/orders', { token: T('custC'), body: { shippingAddress: { ...addr, zipCode: '' } } });
  check('F-CHK-7', 'missing/empty zipCode rejected (422)', r.status === 422, `status ${r.status}`);
  r = await call('POST', '/orders', { token: T('custC'), body: { shippingAddress: addr, paymentMethod: 'bitcoin' } });
  check('F-CHK-8', 'unknown paymentMethod rejected (422)', r.status === 422, `status ${r.status}`);
  r = await call('POST', '/orders', { token: T('custC'), body: { shippingAddress: addr } });
  info('F-CHK-9', 'paymentMethod omitted', `status ${r.status}; stored payment_method=${r.status === 201 ? sql(`SELECT payment_method FROM orders WHERE id=${D(r)?.id}`) : 'n/a'}`);
  info('F-CHK-10', 'payment_status after checkout (no payment integration)', `all orders remain '${sql(`SELECT GROUP_CONCAT(DISTINCT payment_status) FROM orders`)}'`);

  section = 'FUNC-TRACKING';
  r = await call('GET', `/orders/track/${ord?.orderNumber}`);
  const trackTxt = r.text;
  check('F-TRK-1', 'order tracking by number works without login', r.status === 200 && D(r)?.orderNumber === ord?.orderNumber, `status ${r.status}`);
  check('F-TRK-2', 'tracking response exposes no address/email/userId', !/street|zipCode|email|userId|phone|@audit\.test/i.test(trackTxt), '');
  r = await call('GET', '/orders/track/NX-DOESNOTEXIST'); check('F-TRK-3', 'unknown order number -> 404', r.status === 404, `status ${r.status}`);
  r = await call('GET', '/orders/my', { token: T('custC') });
  check('F-TRK-4', 'my orders lists the order', r.status === 200 && JSON.stringify(D(r)).includes(ord?.orderNumber), `status ${r.status}`);
  r = await call('GET', `/orders/${ord?.id}`, { token: T('custC') });
  check('F-TRK-5', 'own order detail works (items + history)', r.status === 200 && D(r)?.items?.length === 1, `status ${r.status}`);
  r = await call('GET', '/orders/my'); check('F-TRK-6', 'my orders requires auth', r.status === 401, `status ${r.status}`);

  section = 'FUNC-DASHBOARDS';
  r = await call('GET', '/admin/dashboard', { token: T('admin') });
  check('F-DASH-1', 'admin dashboard returns data', r.status === 200 && !!D(r), `keys=${Object.keys(D(r) ?? {}).join(',')}`);
  r = await call('GET', '/admin/analytics/revenue', { token: T('admin') });
  info('F-DASH-2', 'admin revenue analytics (only counts paymentStatus=paid)', `status ${r.status}; ${JSON.stringify(D(r)).slice(0, 120)}`);
  r = await call('GET', '/vendor/dashboard', { token: T('vendA') });
  check('F-DASH-3', 'vendor dashboard returns data', r.status === 200, `status ${r.status} ${JSON.stringify(D(r)).slice(0, 140)}`);
  r = await call('GET', '/vendor/products', { token: T('vendA') });
  check('F-DASH-4', "vendor products lists only own products", r.status === 200 && (D(r)?.products ?? D(r) ?? []).every((p) => Number(p.vendorId) === users.vendA.vendorId), `status ${r.status}`);
  r = await call('GET', '/admin/vendors', { token: T('admin') }); check('F-DASH-5', 'admin vendor list works', r.status === 200, `status ${r.status}`);
  r = await call('GET', '/wishlist', { token: T('custC') }); check('F-DASH-6', 'wishlist GET works', r.status === 200, `status ${r.status}`);
  r = await call('GET', '/wishlist'); check('F-DASH-7', 'wishlist requires auth', r.status === 401, `status ${r.status}`);

  // ================================================================ PART 3: DEEP PROBES
  section = 'PROBE-CHECKOUT-INTEGRITY';
  const racy = (await mkProduct('vendA', 'race', { stock: 1, price: 10 })).p; const raceId = Number(racy?.id ?? racy?._id);
  const racers = ['custA', 'custB', 'custC', 'custD'];
  for (const k of racers) { await call('DELETE', '/cart', { token: T(k) }); await call('POST', '/cart/items', { token: T(k), body: { productId: raceId, quantity: 1 } }); }
  const rs = await Promise.all(racers.map((k) => call('POST', '/orders', { token: T(k), body: { shippingAddress: addr, paymentMethod: 'cod' } })));
  const okN = rs.filter((x) => x.status === 201).length; const orderRows = Number(sql(`SELECT COUNT(*) FROM order_items WHERE product_id=${raceId}`));
  check('PROBE-RACE-1', `4 concurrent checkouts of a stock=1 product: exactly 1 succeeds`, okN === 1 && orderRows === 1, `statuses=[${rs.map((x) => x.status)}] order_items=${orderRows} stock=${sql(`SELECT stock FROM products WHERE id=${raceId}`)}`);
  check('PROBE-RACE-2', 'no 5xx during the concurrent checkout race', rs.every((x) => x.status < 500), `statuses=[${rs.map((x) => x.status)}]`);

  const cp = await call('POST', '/admin/coupons', { token: T('admin'), body: { code: `BIG${stamp}`.toUpperCase(), type: 'fixed', value: 500, validFrom: new Date(Date.now() - 864e5).toISOString(), validUntil: new Date(Date.now() + 864e6).toISOString(), isActive: true } });
  info('PROBE-COUPON-0', 'admin creates fixed $500 coupon', `status ${cp.status} ${cp.status >= 400 ? cp.text.slice(0, 160) : ''}`);
  if (cp.status === 201) {
    const code = `BIG${stamp}`.toUpperCase();
    const cpo = await placeOrder('custA', [[prodAid, 1]], { couponCode: code });
    check('PROBE-COUPON-1', 'fixed discount larger than subtotal never yields a negative total', Number(cpo.order?.total) >= 0, `status ${cpo.o?.status} total=${cpo.order?.total} discount=${cpo.order?.discount} subtotal=${cpo.order?.subtotal}`);
    const cpo2 = await placeOrder('custA', [[prodAid, 1]], { couponCode: code });
    check('PROBE-COUPON-2', 'per-user coupon limit (1) enforced on second use', cpo2.o?.status === 400, `second use status ${cpo2.o?.status}`);
  }
  // stale price
  const sp = (await mkProduct('vendA', 'stale', { price: 20, stock: 20 })).p; const spId = Number(sp?.id ?? sp?._id);
  await call('DELETE', '/cart', { token: T('custB') }); await call('POST', '/cart/items', { token: T('custB'), body: { productId: spId, quantity: 1 } });
  await call('PATCH', `/products/${spId}`, { token: T('vendA'), body: { price: 50 } });
  const so = await call('POST', '/orders', { token: T('custB'), body: { shippingAddress: addr, paymentMethod: 'cod' } });
  const charged = Number(sql(`SELECT price FROM order_items WHERE order_id=${D(so)?.id}`));
  check('PROBE-PRICE-1', 'checkout charges the CURRENT product price, not a stale cart price', charged === 50, `cart price 20 -> product price 50; order item charged ${charged}`);
  // cancel restock
  const rp = (await mkProduct('vendA', 'restock', { price: 12, stock: 10 })).p; const rpId = Number(rp?.id ?? rp?._id);
  const ro = await placeOrder('custB', [[rpId, 3]]); const roId = Number(ro.order?.id);
  const afterOrder = Number(sql(`SELECT stock FROM products WHERE id=${rpId}`));
  await call('PATCH', `/orders/${roId}/status`, { token: T('vendA'), body: { status: 'cancelled' } });
  check('PROBE-RESTOCK-1', 'cancelling an order returns stock to inventory', Number(sql(`SELECT stock FROM products WHERE id=${rpId}`)) === 10, `stock after order=${afterOrder}, after cancel=${sql(`SELECT stock FROM products WHERE id=${rpId}`)}`);

  section = 'PROBE-AUTH-LIFECYCLE';
  // password reset must revoke refresh tokens
  const lc = await call('POST', '/auth/login', { body: { email: users.custC.email, password: PW } });
  const rc = (lc.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('refreshToken='))?.split(';')[0].split('=')[1];
  const rawTok = crypto.randomBytes(24).toString('hex'); const hashTok = crypto.createHash('sha256').update(rawTok).digest('hex');
  sql(`UPDATE users SET password_reset_token='${hashTok}', password_reset_expires=DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id=${users.custC.id}`);
  r = await call('POST', '/auth/reset-password', { body: { token: rawTok, password: 'New-Passw0rd!y' } });
  check('PROBE-AUTH-1', 'reset-password with valid token succeeds', r.status === 200, `status ${r.status}`);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: rc } });
  check('PROBE-AUTH-2', 'refresh token issued BEFORE a password reset is revoked', r.status === 401, `status ${r.status}`);
  r = await call('POST', '/auth/reset-password', { body: { token: rawTok, password: 'Another-Passw0rd!z' } });
  check('PROBE-AUTH-3', 'reset token is single-use', r.status === 400 || r.status === 401 || r.status === 422, `status ${r.status}`);
  const f1 = await call('POST', '/auth/forgot-password', { body: { email: users.custA.email } });
  const f2 = await call('POST', '/auth/forgot-password', { body: { email: `nobody.${stamp}@audit.test` } });
  check('PROBE-AUTH-4', 'forgot-password gives identical response for known/unknown email (no enumeration)', f1.status === f2.status && JSON.stringify(f1.body?.message) === JSON.stringify(f2.body?.message), `${f1.status}/${f2.status}`);
  // refresh for a deactivated user
  const dl = await call('POST', '/auth/login', { body: { email: users.custD.email, password: PW } });
  const rd = (dl.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('refreshToken='))?.split(';')[0].split('=')[1];
  await call('PATCH', `/admin/users/${users.custD.id}`, { token: T('admin'), body: { isActive: false } });
  r = await call('POST', '/auth/refresh', { body: { refreshToken: rd } });
  check('PROBE-AUTH-5', 'deactivated user cannot mint new tokens via refresh', [401, 403].includes(r.status), `status ${r.status}`);
  await call('PATCH', `/admin/users/${users.custD.id}`, { token: T('admin'), body: { isActive: true } });
  r = await call('POST', '/auth/logout', { token: T('custB') });
  r = await call('GET', '/auth/me', { token: T('custB') });
  info('PROBE-AUTH-6', 'access token after /auth/logout (stateless JWT)', `GET /auth/me -> ${r.status}`);
  await login('custB');

  section = 'PROBE-ROBUSTNESS';
  for (const [m, p, b, tk] of [['PATCH', '/admin/vendors/abc', { status: 'approved' }, 'admin'], ['PATCH', '/admin/users/abc', { isActive: true }, 'admin'], ['PATCH', '/admin/reviews/abc', { isApproved: true }, 'admin'], ['GET', '/admin/users?role=bogus', undefined, 'admin'], ['GET', '/admin/users?role[not]=customer', undefined, 'admin'], ['GET', '/admin/users?limit=100000&page=abc', undefined, 'admin'], ['GET', '/orders/admin/all?status=bogus', undefined, 'admin'], ['GET', '/orders/abc', undefined, 'custA'], ['PATCH', '/orders/abc/status', { status: 'shipped' }, 'admin'], ['POST', '/admin/coupons', {}, 'admin'], ['POST', '/admin/banners', {}, 'admin'], ['POST', '/admin/coupons', { code: 1, type: 'x', value: 'y' }, 'admin']]) {
    const x = await call(m, p, { token: T(tk), body: b });
    check(`PROBE-ROB-${m}-${p}`, `${m} ${p} does not 500`, x.status < 500, `status ${x.status}`);
  }
  r = await call('POST', '/auth/refresh', { body: {} }); check('PROBE-ROB-refresh-empty', 'POST /auth/refresh with no token -> 401 (not 500)', r.status === 401, `status ${r.status}`);
  r = await call('POST', '/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } }); check('PROBE-ROB-login-obj', 'login with object-typed credentials rejected 4xx', r.status >= 400 && r.status < 500, `status ${r.status}`);
  r = await call('POST', '/ai/chat', { body: { message: { a: 1 } } }); check('PROBE-ROB-ai-chat', 'POST /ai/chat with non-string message does not 500', r.status < 500, `status ${r.status}`);
  r = await call('GET', '/ai/search-suggestions?q[a]=b'); check('PROBE-ROB-ai-suggest', 'GET /ai/search-suggestions?q[a]=b does not 500', r.status < 500, `status ${r.status}`);

  section = 'PROBE-HEADERS';
  const hr = await fetch(`${BASE}/health`, { headers: { Origin: 'https://evil.example' } }); const hh = hr.headers;
  check('PROBE-HDR-1', 'x-powered-by header removed', !hh.get('x-powered-by'), `x-powered-by=${hh.get('x-powered-by')}`);
  check('PROBE-HDR-2', 'nosniff + frame protections present', hh.get('x-content-type-options') === 'nosniff' && !!(hh.get('x-frame-options') || hh.get('content-security-policy')), `nosniff=${hh.get('x-content-type-options')} xfo=${hh.get('x-frame-options')}`);
  check('PROBE-HDR-3', 'CORS does not allow an arbitrary origin', hh.get('access-control-allow-origin') !== 'https://evil.example' && hh.get('access-control-allow-origin') !== '*', `ACAO=${hh.get('access-control-allow-origin')}`);
  const hr2 = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:3000' } });
  check('PROBE-HDR-4', 'CORS allows the configured client origin with credentials', hr2.headers.get('access-control-allow-origin') === 'http://localhost:3000' && hr2.headers.get('access-control-allow-credentials') === 'true', `ACAO=${hr2.headers.get('access-control-allow-origin')}`);

  fs.writeFileSync(process.env.AUDIT_RESULTS || './audit-results.json', JSON.stringify({ results, users }, null, 2));
  globalThis.__ctx = { users, prodAid, prodBid, o1id, o2id, catId, prodBody, mkProduct, placeOrder, sql, stamp, addr, refreshCookie };
}

main().then(async () => {
  const pass = results.filter((x) => x.pass === true).length, fail = results.filter((x) => x.pass === false).length;
  console.log(`\n=== PART 1 DONE: ${pass} pass, ${fail} fail, ${results.filter((x) => x.pass === null).length} info ===`);
  process.exit(0);
}).catch((e) => { console.error('HARNESS ERROR', e); fs.writeFileSync(process.env.AUDIT_RESULTS || './audit-results.json', JSON.stringify({ results, error: String(e) }, null, 2)); process.exit(2); });
