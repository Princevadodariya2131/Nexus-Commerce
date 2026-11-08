import { ROLES } from '@nexus/shared';

/**
 * Authentication and room authorization for Socket.io.
 *
 * - A connection is rejected unless it presents a valid token:
 *     1. `auth: { token }` in the Socket.io handshake. This is a short-lived token
 *        from `GET /auth/socket-token` (the access cookie is httpOnly, so browser
 *        JavaScript cannot read it, and it is not sent to a different API origin), or
 *     2. the `accessToken` cookie, when web and API share an origin.
 * - A connected socket may only join rooms it is entitled to (see authorizeRoom).
 *
 * Everything the module needs from the outside world is injected, so the rules
 * are unit-testable without a database or a running Socket.io server.
 */

export const SOCKET_TOKEN_PURPOSE = 'socket';
export const MAX_ROOMS_PER_SOCKET = 10;
const MAX_TOKEN_LENGTH = 4096;

/** user:<id> (own room only), vendor:<id> (own approved vendor only), admin (admins only). */
export const ROOM_PATTERN = /^(?:user:[1-9]\d{0,9}|vendor:[1-9]\d{0,9}|admin)$/;

export interface VerifiedToken {
  userId: string;
  purpose?: string;
  exp?: number;
}

export interface SocketPrincipal {
  userId: number;
  role: string;
  exp?: number;
}

export interface SocketAuthDeps {
  /** Verify signature and expiry; must throw when the token is invalid. */
  verifyToken: (token: string) => VerifiedToken;
  /** Fresh account state from the database. */
  loadUser: (userId: number) => Promise<{ isActive: boolean; role: string } | null>;
  /** Id of the user's APPROVED vendor profile, or null. */
  loadVendorId: (userId: number) => Promise<number | null>;
  now?: () => number;
  log?: (message: string) => void;
}

export interface JoinResult {
  ok: boolean;
  error?: string;
}

export interface SocketLike {
  id: string;
  handshake: { auth?: unknown; headers?: Record<string, unknown> };
  data: Record<string, unknown>;
  rooms: Set<string>;
  join(room: string): void | Promise<void>;
  on(event: string, listener: (...args: any[]) => void): unknown;
}

export interface IoLike {
  use(fn: (socket: SocketLike, next: (err?: Error) => void) => void): unknown;
  on(event: string, listener: (socket: SocketLike) => void): unknown;
}

export function parseCookies(header: unknown): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    let value = part.slice(index + 1).trim();
    if (!name || name in out) continue;
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function extractSocketToken(handshake: {
  auth?: unknown;
  headers?: Record<string, unknown>;
}): string | null {
  const auth = handshake.auth as { token?: unknown } | undefined;
  if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
    return auth.token.length < MAX_TOKEN_LENGTH ? auth.token : null;
  }
  const cookie = parseCookies(handshake.headers?.cookie).accessToken;
  return cookie && cookie.length < MAX_TOKEN_LENGTH ? cookie : null;
}

export async function authenticateSocket(
  handshake: { auth?: unknown; headers?: Record<string, unknown> },
  deps: SocketAuthDeps
): Promise<SocketPrincipal> {
  const token = extractSocketToken(handshake);
  if (!token) throw new Error('Authentication required');

  let claims: VerifiedToken;
  try {
    claims = deps.verifyToken(token);
  } catch {
    throw new Error('Invalid or expired token');
  }

  // Only access tokens (no purpose) and dedicated socket tokens are acceptable.
  if (claims.purpose !== undefined && claims.purpose !== SOCKET_TOKEN_PURPOSE) {
    throw new Error('Invalid or expired token');
  }

  const userId = parseInt(claims.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid or expired token');

  const user = await deps.loadUser(userId);
  if (!user || !user.isActive) throw new Error('Account inactive or not found');

  // The role always comes from the database, never from the token.
  return { userId, role: user.role, exp: claims.exp };
}

export async function authorizeRoom(
  principal: SocketPrincipal,
  room: unknown,
  deps: Pick<SocketAuthDeps, 'loadVendorId'>
): Promise<boolean> {
  if (typeof room !== 'string' || !ROOM_PATTERN.test(room)) return false;

  if (room === 'admin') {
    return principal.role === ROLES.ADMIN || principal.role === ROLES.SUPER_ADMIN;
  }

  const [kind, rawId] = room.split(':');
  const id = Number(rawId);

  if (kind === 'user') return id === principal.userId;

  if (kind === 'vendor') {
    if (principal.role !== ROLES.VENDOR) return false;
    const vendorId = await deps.loadVendorId(principal.userId);
    return vendorId !== null && vendorId === id;
  }

  return false;
}

export function attachSocketAuth(io: IoLike, deps: SocketAuthDeps): void {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? (() => undefined);

  io.use((socket, next) => {
    authenticateSocket(socket.handshake, deps)
      .then((principal) => {
        socket.data.principal = principal;
        next();
      })
      .catch((error: Error) => next(new Error(error.message)));
  });

  io.on('connection', (socket) => {
    socket.on('join', async (room: unknown, ack?: unknown) => {
      const reply = (result: JoinResult) => {
        if (typeof ack === 'function') (ack as (r: JoinResult) => void)(result);
      };

      try {
        const principal = socket.data.principal as SocketPrincipal | undefined;
        if (!principal) return reply({ ok: false, error: 'unauthenticated' });

        if (principal.exp !== undefined && principal.exp * 1000 <= now()) {
          return reply({ ok: false, error: 'token_expired' });
        }

        // Socket.io puts every socket in a room named after its own id.
        if (socket.rooms.size > MAX_ROOMS_PER_SOCKET) {
          return reply({ ok: false, error: 'too_many_rooms' });
        }

        // Re-check the account on every join so a suspension takes effect immediately.
        const user = await deps.loadUser(principal.userId);
        if (!user || !user.isActive) return reply({ ok: false, error: 'forbidden' });

        const allowed = await authorizeRoom({ ...principal, role: user.role }, room, deps);
        if (!allowed) {
          log(`socket ${socket.id} (user ${principal.userId}) denied room ${String(room).slice(0, 40)}`);
          return reply({ ok: false, error: 'forbidden' });
        }

        await socket.join(room as string);
        return reply({ ok: true });
      } catch {
        return reply({ ok: false, error: 'error' });
      }
    });
  });
}
