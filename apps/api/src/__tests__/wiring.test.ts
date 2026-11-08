import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * STATIC checks on the route files. They cannot prove behaviour (the behavioural
 * tests do that) but they fail loudly if someone later removes a guard from a route.
 */
const src = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

/** The text of one route registration, from `router.<verb>(<path>` up to its closing `);`. */
const routeBlock = (file: string, verb: string, routePath: string): string => {
  const text = src(file);
  const re = new RegExp(`router\\.${verb}\\(\\s*['"]${routePath.replace(/[/:]/g, '\\$&')}['"][\\s\\S]*?\\);`);
  const match = text.match(re);
  assert.ok(match, `route ${verb.toUpperCase()} ${routePath} not found in ${file}`);
  return match[0];
};
const mustContain = (block: string, ...needles: string[]) => {
  for (const needle of needles) assert.ok(block.includes(needle), `expected route to include ${needle}\n--- route ---\n${block}`);
};
const order = (block: string, first: string, second: string) =>
  assert.ok(block.indexOf(first) < block.indexOf(second), `${first} must come before ${second}`);

describe('route wiring', () => {
  it('PATCH /orders/:id/status: role check, then vendor context, then validation', () => {
    const block = routeBlock('routes/order.routes.ts', 'patch', '/:id/status');
    mustContain(block, 'authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR)', 'requireVendorContext', 'validate(updateOrderStatusSchema)');
    order(block, 'authorize', 'requireVendorContext');
    order(block, 'requireVendorContext', 'validate(');
  });
  it('POST /orders validates the body and all order routes require authentication', () => {
    mustContain(routeBlock('routes/order.routes.ts', 'post', '/'), 'validate(createOrderSchema)');
    const text = src('routes/order.routes.ts');
    assert.ok(text.indexOf('router.use(authenticate)') < text.indexOf("router.patch("));
  });
  it('product writes require role, vendor context and (create/update) the role-aware whitelist', () => {
    for (const [verb, route, validated] of [['post', '/', true], ['patch', '/:id', true], ['delete', '/:id', false]] as const) {
      const block = routeBlock('routes/product.routes.ts', verb, route);
      mustContain(block, 'authenticate', 'authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR)', 'requireVendorContext');
      if (validated) mustContain(block, 'validateProductWrite(');
    }
  });
  it('PATCH /auth/me uses the strict profile schema; socket-token requires authentication', () => {
    mustContain(routeBlock('routes/auth.routes.ts', 'patch', '/me'), 'authenticate', 'validate(updateProfileSchema)');
    mustContain(routeBlock('routes/auth.routes.ts', 'get', '/socket-token'), 'authenticate');
  });
  it('cart item writes and review creation validate input', () => {
    mustContain(routeBlock('routes/cart.routes.ts', 'post', '/items'), 'validate(addCartItemSchema)');
    mustContain(routeBlock('routes/cart.routes.ts', 'patch', '/items/:productId'), 'validate(updateCartItemSchema)');
    mustContain(routeBlock('routes/review.routes.ts', 'post', '/'), 'authenticate', 'validate(createReviewSchema)');
  });
  it('the admin router is admin-only and its mutations validate their bodies', () => {
    assert.ok(src('routes/admin.routes.ts').includes('router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN))'));
    mustContain(routeBlock('routes/admin.routes.ts', 'patch', '/users/:id'), 'validate(updateUserStatusSchema)');
    mustContain(routeBlock('routes/admin.routes.ts', 'patch', '/vendors/:id'), 'validate(updateVendorStatusSchema)');
    mustContain(routeBlock('routes/admin.routes.ts', 'patch', '/reviews/:id'), 'validate(moderateReviewSchema)');
  });
  it('the vendor router requires the vendor role for every route', () => {
    const text = src('routes/vendor.routes.ts');
    assert.match(text, /router\.use\(\s*authenticate\s*,\s*authorize\(ROLES\.VENDOR/);
  });
  it('the socket server authenticates connections and has no unauthenticated join handler', () => {
    const server = src('server.ts');
    assert.ok(server.includes('attachSocketAuth('));
    assert.equal(/socket\.on\(\s*['"]join['"]/.test(server), false, 'server.ts must not register its own unguarded join handler');
  });
});
