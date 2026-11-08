import './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  MAX_ROOMS_PER_SOCKET,
  ROOM_PATTERN,
  attachSocketAuth,
  extractSocketToken,
  parseCookies,
  type IoLike,
  type JoinResult,
  type SocketAuthDeps,
  type SocketLike,
} from '../realtime/socketAuth';

const secret = process.env.JWT_SECRET as string;
const sign = (claims: Record<string, unknown>, expiresIn = 60, key = secret) => jwt.sign(claims, key, { expiresIn });

// ---- fakes (a minimal stand-in for Socket.io's Server/Socket) -----------------------------
class FakeSocket implements SocketLike {
  id = 's1';
  data: Record<string, unknown> = {};
  rooms = new Set<string>(['s1']);
  handlers = new Map<string, (...args: any[]) => unknown>();
  constructor(public handshake: SocketLike['handshake']) {}
  join(room: string) {
    this.rooms.add(room);
  }
  on(event: string, listener: (...args: any[]) => unknown) {
    this.handlers.set(event, listener);
    return this;
  }
  join_(room: unknown): Promise<JoinResult> {
    return new Promise((resolve) => this.handlers.get('join')!(room, resolve));
  }
}
class FakeIo implements IoLike {
  private middlewares: Array<(s: SocketLike, next: (e?: Error) => void) => void> = [];
  private onConnection: Array<(s: SocketLike) => void> = [];
  use(fn: (s: SocketLike, next: (e?: Error) => void) => void) {
    this.middlewares.push(fn);
  }
  on(_event: string, fn: (s: SocketLike) => void) {
    this.onConnection.push(fn);
  }
  /** Mirrors Socket.io: run middleware; a rejected handshake never reaches 'connection'. */
  async connect(handshake: SocketLike['handshake']): Promise<{ socket: FakeSocket; error?: Error }> {
    const socket = new FakeSocket(handshake);
    for (const mw of this.middlewares) {
      const error = await new Promise<Error | undefined>((resolve) => mw(socket, (e) => resolve(e)));
      if (error) return { socket, error };
    }
    this.onConnection.forEach((fn) => fn(socket));
    return { socket };
  }
}

// ---- world --------------------------------------------------------------------------------
type U = { isActive: boolean; role: string };
let users: Record<number, U>;
let vendorOf: Record<number, number | null>; // userId -> approved vendor id
let clock: number;
let logs: string[];
let io: FakeIo;

const deps = (): SocketAuthDeps => ({
  verifyToken: (token) => jwt.verify(token, secret) as any,
  loadUser: async (id) => users[id] ?? null,
  loadVendorId: async (userId) => vendorOf[userId] ?? null,
  now: () => clock,
  log: (m) => logs.push(m),
});

beforeEach(() => {
  users = {
    1: { isActive: true, role: 'admin' },
    2: { isActive: true, role: 'vendor' },
    3: { isActive: true, role: 'vendor' },
    4: { isActive: true, role: 'customer' },
    5: { isActive: false, role: 'customer' },
    9: { isActive: true, role: 'super_admin' },
  };
  vendorOf = { 2: 10, 3: 11 };
  clock = Date.now();
  logs = [];
  io = new FakeIo();
  attachSocketAuth(io, deps());
});
const viaCookie = (token: string) => ({ headers: { cookie: `theme=dark; accessToken=${token}; other=1` } });
const viaAuth = (token: string) => ({ auth: { token }, headers: {} });
const asUser = async (id: number, role = 'customer') => {
  const { socket, error } = await io.connect(viaAuth(sign({ userId: String(id), role, purpose: 'socket' })));
  assert.equal(error, undefined);
  return socket;
};

describe('socket handshake authentication', () => {
  it('rejects a connection without a token', async () => {
    const { error } = await io.connect({ headers: {} });
    assert.match(error!.message, /authentication required/i);
  });
  it('rejects garbage, wrongly signed and expired tokens', async () => {
    assert.match((await io.connect(viaAuth('garbage'))).error!.message, /invalid or expired/i);
    assert.match((await io.connect(viaAuth(sign({ userId: '1' }, 60, 'x'.repeat(32))))).error!.message, /invalid or expired/i);
    assert.match((await io.connect(viaAuth(sign({ userId: '4', purpose: 'socket' }, -5)))).error!.message, /invalid or expired/i);
  });
  it('rejects tokens with an unknown purpose (e.g. other special-purpose tokens)', async () => {
    assert.match((await io.connect(viaAuth(sign({ userId: '4', purpose: 'refresh' })))).error!.message, /invalid or expired/i);
  });
  it('rejects deactivated and unknown accounts', async () => {
    assert.match((await io.connect(viaAuth(sign({ userId: '5', purpose: 'socket' })))).error!.message, /inactive/i);
    assert.match((await io.connect(viaAuth(sign({ userId: '999', purpose: 'socket' })))).error!.message, /inactive/i);
    assert.match((await io.connect(viaAuth(sign({ userId: 'abc', purpose: 'socket' })))).error!.message, /invalid or expired/i);
  });
  it('accepts a socket token and an access-token cookie', async () => {
    assert.equal((await io.connect(viaAuth(sign({ userId: '4', purpose: 'socket' })))).error, undefined);
    assert.equal((await io.connect(viaCookie(sign({ userId: '4', role: 'customer' })))).error, undefined);
  });
  it('takes the role from the database, never from the token', async () => {
    const { socket } = await io.connect(viaAuth(sign({ userId: '4', role: 'admin', purpose: 'socket' })));
    assert.equal((socket.data.principal as any).role, 'customer');
  });
});

describe('cookie and token parsing', () => {
  it('parses a cookie header, first value wins, and is safe against prototype keys', () => {
    const cookies = parseCookies('a=1; b=%20two; a=2; __proto__=polluted; c="quoted"');
    assert.equal(cookies.a, '1');
    assert.equal(cookies.b, ' two');
    assert.equal(cookies.c, 'quoted');
    assert.equal(({} as any).polluted, undefined);
    assert.equal(Object.keys(parseCookies(undefined)).length, 0);
    assert.equal(Object.getPrototypeOf(parseCookies('a=1')), null); // null-prototype map by design
    assert.equal(parseCookies('bad%zz=1; x=%E0%A4%A').x, '%E0%A4%A');
  });
  it('prefers auth.token over the cookie and ignores oversized tokens', () => {
    assert.equal(extractSocketToken({ auth: { token: 'from-auth' }, headers: { cookie: 'accessToken=from-cookie' } }), 'from-auth');
    assert.equal(extractSocketToken({ headers: { cookie: 'accessToken=from-cookie' } }), 'from-cookie');
    assert.equal(extractSocketToken({ auth: { token: 'x'.repeat(5000) } }), null);
    assert.equal(extractSocketToken({ auth: { token: 123 }, headers: {} }), null);
  });
});

describe('room authorization', () => {
  it('lets a user join only their own user room', async () => {
    const socket = await asUser(4);
    assert.deepEqual(await socket.join_('user:4'), { ok: true });
    assert.ok(socket.rooms.has('user:4'));
    assert.deepEqual(await socket.join_('user:1'), { ok: false, error: 'forbidden' });
    assert.equal(socket.rooms.has('user:1'), false);
  });
  it("denies another vendor's room and an unapproved vendor's room", async () => {
    const socket = await asUser(2, 'vendor');
    assert.deepEqual(await socket.join_('vendor:10'), { ok: true });
    assert.deepEqual(await socket.join_('vendor:11'), { ok: false, error: 'forbidden' });
    vendorOf[2] = null; // vendor suspended after connecting
    const other = await asUser(2, 'vendor');
    assert.deepEqual(await other.join_('vendor:10'), { ok: false, error: 'forbidden' });
  });
  it('denies a customer any vendor room', async () => {
    const socket = await asUser(4);
    assert.deepEqual(await socket.join_('vendor:10'), { ok: false, error: 'forbidden' });
  });
  it('allows the admin room for admins and super admins only', async () => {
    assert.deepEqual(await (await asUser(1, 'admin')).join_('admin'), { ok: true });
    assert.deepEqual(await (await asUser(9, 'super_admin')).join_('admin'), { ok: true });
    for (const id of [2, 4]) assert.deepEqual(await (await asUser(id)).join_('admin'), { ok: false, error: 'forbidden' });
  });
  it('rejects malformed and non-string room names', async () => {
    const socket = await asUser(1, 'admin');
    const bad: unknown[] = ['', 'user:', 'user:0', 'user:01', 'user:-1', 'user:1 ', ' user:1', 'USER:1', 'admin:1', 'admin ', 'vendor:abc',
      'user:' + '9'.repeat(40), '../admin', 'user:1\nadmin', 123, null, undefined, {}, ['admin'], true];
    for (const room of bad) {
      assert.deepEqual(await socket.join_(room), { ok: false, error: 'forbidden' }, `room ${JSON.stringify(room)}`);
    }
    assert.deepEqual([...socket.rooms], ['s1']);
  });
  it('the room pattern itself matches only the three allowed shapes', () => {
    for (const ok of ['user:1', 'user:123', 'vendor:10', 'admin']) assert.ok(ROOM_PATTERN.test(ok), ok);
    for (const no of ['user:', 'vendor', 'order:1', 'user:1:2']) assert.equal(ROOM_PATTERN.test(no), false, no);
  });
  it('re-checks the account on every join (suspension and demotion take effect immediately)', async () => {
    const admin = await asUser(1, 'admin');
    users[1] = { isActive: true, role: 'customer' }; // demoted after connecting
    assert.deepEqual(await admin.join_('admin'), { ok: false, error: 'forbidden' });
    const customer = await asUser(4);
    users[4].isActive = false;
    assert.deepEqual(await customer.join_('user:4'), { ok: false, error: 'forbidden' });
  });
  it('refuses joins once the token has expired', async () => {
    const token = sign({ userId: '4', purpose: 'socket' }, 60);
    const { socket } = await io.connect(viaAuth(token));
    clock += 61_000;
    assert.deepEqual(await socket!.join_('user:4'), { ok: false, error: 'token_expired' });
  });
  it('caps the number of rooms per socket', async () => {
    const socket = await asUser(4);
    for (let i = 0; i < MAX_ROOMS_PER_SOCKET; i++) socket.rooms.add(`filler-${i}`);
    assert.deepEqual(await socket.join_('user:4'), { ok: false, error: 'too_many_rooms' });
  });
  it('logs denied attempts and tolerates a missing acknowledgement callback', async () => {
    const socket = await asUser(4);
    await socket.join_('user:1');
    assert.equal(logs.length, 1);
    assert.match(logs[0], /denied room user:1/);
    assert.doesNotThrow(() => socket.handlers.get('join')!('user:1')); // no ack function
  });
  it('a socket that somehow skipped the handshake cannot join anything', async () => {
    const socket = new FakeSocket({ headers: {} });
    (io as any).onConnection.forEach((fn: (s: SocketLike) => void) => fn(socket));
    assert.deepEqual(await socket.join_('user:4'), { ok: false, error: 'unauthenticated' });
  });
});
