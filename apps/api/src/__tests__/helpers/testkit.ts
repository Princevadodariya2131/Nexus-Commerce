/**
 * Test kit for the API tests.
 *
 * IMPORTANT: import this file FIRST in every test file. It installs module mocks
 * (database client, e-mail, password hashing, logger) before any application code
 * is loaded, and sets the environment the config module reads.
 *
 * The database is an in-memory double (FakeDb). The tests therefore exercise the
 * real middleware, validators, policies and services; only the persistence layer
 * and third-party side effects are replaced. They do NOT test MySQL/Prisma behaviour.
 */
import Module from 'node:module';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

type Row = Record<string, any>;

export class NotFoundError extends Error {
  code = 'P2025';
}

const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    return row[key] === expected;
  });

const project = (row: Row, select?: Row): Row => {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [key, on] of Object.entries(select)) if (on) out[key] = row[key];
  return out;
};

export class FakeDb {
  users: Row[] = [];
  vendors: Row[] = [];
  products: Row[] = [];
  orders: Row[] = [];
  orderItems: Row[] = [];
  statusHistory: Row[] = [];
  /** Every write, in order: lets tests assert that a rejected request changed nothing. */
  writes: { model: string; op: string; args: Row }[] = [];
  private nextId = 1000;

  reset(): void {
    this.users = [];
    this.vendors = [];
    this.products = [];
    this.orders = [];
    this.orderItems = [];
    this.statusHistory = [];
    this.writes = [];
    this.nextId = 1000;
    this.down = false;
  }

  private update(table: Row[], model: string, args: Row): Row {
    const row = table.find((r) => matches(r, args.where));
    if (!row) throw new NotFoundError('Record to update not found');
    this.writes.push({ model, op: 'update', args });
    return row;
  }

  /** Set to true to simulate a database outage for the readiness probe. */
  down = false;

  prisma = {
    $queryRaw: async () => {
      if (this.down) throw new Error('simulated database outage');
      return [{ 1: 1 }];
    },
    user: {
      findUnique: async (args: Row) => {
        const row = this.users.find((r) => matches(r, args.where));
        return row ? project(row, args.select) : null;
      },
      update: async (args: Row) => {
        const row = this.update(this.users, 'user', args);
        Object.assign(row, Object.fromEntries(Object.entries(args.data).filter(([, v]) => v !== undefined)));
        return project(row, args.select);
      },
    },
    vendor: {
      findUnique: async (args: Row) => {
        const row = this.vendors.find((r) => matches(r, args.where));
        return row ? project(row, args.select) : null;
      },
    },
    product: {
      findFirst: async (args: Row) => {
        const row = this.products.find((r) => matches(r, args.where));
        return row ? project(row, args.select) : null;
      },
      create: async (args: Row) => {
        this.writes.push({ model: 'product', op: 'create', args });
        const row = { id: this.nextId++, rating: 0, reviewCount: 0, soldCount: 0, isActive: true, ...args.data };
        this.products.push(row);
        return { ...row };
      },
      update: async (args: Row) => {
        const row = this.update(this.products, 'product', args);
        for (const [key, value] of Object.entries<any>(args.data)) {
          if (value === undefined) continue;
          if (value && typeof value === 'object' && 'increment' in value) row[key] = (row[key] ?? 0) + value.increment;
          else if (value && typeof value === 'object' && 'decrement' in value) row[key] = (row[key] ?? 0) - value.decrement;
          else row[key] = value;
        }
        return { ...row };
      },
    },
    orderItem: {
      findMany: async (args: Row) =>
        this.orderItems.filter((r) => matches(r, args.where)).map((r) => project(r, args.select)),
    },
    /** Pass-through transaction: the fake has no isolation, which is enough for single-actor tests. */
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(this.prisma),
    order: {
      findUnique: async (args: Row) => {
        const row = this.orders.find((r) => matches(r, args.where));
        if (!row) return null;
        return {
          ...project(row, undefined),
          items: this.orderItems
            .filter((i) => i.orderId === row.id)
            .map((i) => ({ productId: i.productId, quantity: i.quantity ?? 1 })),
        };
      },
      update: async (args: Row) => {
        const row = this.update(this.orders, 'order', args);
        if (args.data.status !== undefined) row.status = args.data.status;
        const history = args.data.statusHistory?.create;
        if (history) this.statusHistory.push({ orderId: row.id, ...history });
        return {
          ...row,
          items: this.orderItems.filter((i) => i.orderId === row.id),
          statusHistory: this.statusHistory.filter((h) => h.orderId === row.id),
        };
      },
    },
  };

  // ---- seeding helpers -----------------------------------------------------
  addUser(row: Row): Row {
    const user: Row = { isActive: true, role: 'customer', ...row };
    this.users.push(user);
    return user;
  }
  addVendor(row: Row): Row {
    const vendor: Row = { status: 'approved', ...row };
    this.vendors.push(vendor);
    return vendor;
  }
  addProduct(row: Row): Row {
    const product: Row = { isActive: true, ...row };
    this.products.push(product);
    return product;
  }
  addOrder(row: Row, itemVendorIds: (number | null)[]): Row {
    const order: Row = { status: 'pending', ...row };
    this.orders.push(order);
    itemVendorIds.forEach((vendorId, index) =>
      this.orderItems.push({ id: this.nextId++, orderId: order.id, vendorId, productId: 1 + index, quantity: 1 })
    );
    return order;
  }
  get writeCount(): number {
    return this.writes.length;
  }
}

export const db = new FakeDb();

// ---- module mocks ------------------------------------------------------------
const mocks: [RegExp, unknown][] = [
  [
    /(^|\/)lib\/prisma$/,
    { prisma: db.prisma, connectDatabase: async () => undefined, disconnectDatabase: async () => undefined },
  ],
  [/(^|\/)email\.service$/, { emailService: new Proxy({}, { get: () => async () => undefined }) }],
  [
    /(^|\/)utils\/password$/,
    {
      hashPassword: async (plain: string) => `hashed:${plain}`,
      comparePassword: async (plain: string, hash: string) => hash === `hashed:${plain}`,
    },
  ],
  [
    /(^|\/)utils\/logger$/,
    {
      logger: { debug() {}, info() {}, warn() {}, error() {}, stream: { write() {} } },
    },
  ],
  [
    /^@prisma\/client\/runtime\/library$/,
    { Decimal: class FakeDecimal { constructor(private v: unknown) {} toNumber() { return Number(this.v); } toString() { return String(this.v); } } },
  ],
];

/** Per-test overrides keyed by the exact module specifier; they win over the static mocks. */
export const dynamicMocks = new Map<string, unknown>();

const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...rest: unknown[]) {
  if (dynamicMocks.has(request)) return dynamicMocks.get(request);
  for (const [pattern, exports] of mocks) if (pattern.test(request)) return exports;
  return originalLoad.call(this, request, ...rest);
};

// ---- request / response fakes -------------------------------------------------
export interface FakeResponse {
  statusCode: number;
  body: any;
  cookies: { name: string; value: string }[];
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
  cookie(name: string, value: string): FakeResponse;
  clearCookie(name: string): FakeResponse;
}

export const fakeReq = (over: Row = {}): any => ({
  headers: {},
  cookies: {},
  params: {},
  query: {},
  body: {},
  ...over,
});

/** Runs one Express-style handler and resolves when it responds or calls next(). */
export const invoke = (
  handler: (req: any, res: any, next: (err?: unknown) => void) => unknown,
  req: any
): Promise<{ res: FakeResponse; err?: any; nextCalled: boolean }> =>
  new Promise((resolve) => {
    const res: FakeResponse = {
      statusCode: 200,
      body: undefined,
      cookies: [],
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(body) {
        res.body = body;
        resolve({ res, nextCalled: false });
        return res;
      },
      cookie(name, value) {
        res.cookies.push({ name, value });
        return res;
      },
      clearCookie() {
        return res;
      },
    };
    const result = handler(req, res, (err?: unknown) => resolve({ res, err, nextCalled: !err }));
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch((error) => resolve({ res, err: error, nextCalled: false }));
    }
  });

/** Runs handlers in order like Express does, stopping at the first response or error. */
export const runChain = async (handlers: Array<(req: any, res: any, next: (e?: unknown) => void) => unknown>, req: any) => {
  let last: { res: FakeResponse; err?: any; nextCalled: boolean } | undefined;
  for (const handler of handlers) {
    last = await invoke(handler, req);
    if (!last.nextCalled) return last;
  }
  return last!;
};

/** Status code a request would produce: AppError carries its own, responses carry theirs. */
export const statusOf = (outcome: { res: FakeResponse; err?: any }): number =>
  outcome.err ? outcome.err.statusCode ?? 500 : outcome.res.statusCode;
