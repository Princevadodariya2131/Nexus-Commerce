import { fakeReq, invoke } from './helpers/testkit';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkReadiness } from '../lib/health';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';

describe('readiness probe', () => {
  it('is ok when the database answers', async () => {
    const result = await checkReadiness({ $queryRaw: async () => [{ 1: 1 }] });
    assert.deepEqual(result, { ok: true, checks: { database: 'up' } });
  });
  it('is not ok when the database errors', async () => {
    const result = await checkReadiness({ $queryRaw: async () => { throw new Error('connection refused'); } });
    assert.deepEqual(result, { ok: false, checks: { database: 'down' } });
  });
  it('is not ok when the database hangs (times out instead of blocking)', async () => {
    const started = Date.now();
    const result = await checkReadiness({ $queryRaw: () => new Promise(() => undefined) }, 50);
    assert.equal(result.ok, false);
    assert.ok(Date.now() - started < 1000);
  });
  it('does not leak the underlying error message', async () => {
    const result = await checkReadiness({ $queryRaw: async () => { throw new Error('password=secret host=10.0.0.5'); } });
    assert.equal(JSON.stringify(result).includes('secret'), false);
  });
});

describe('error handler status mapping', () => {
  const handle = async (err: unknown) => {
    const out = await invoke((req, res) => errorHandler(err as Error, req, res, () => undefined), fakeReq());
    return out.res;
  };
  it('keeps AppError status codes', async () => {
    assert.equal((await handle(new AppError('nope', 403))).statusCode, 403);
  });
  it('maps malformed JSON to 400 and oversized bodies to 413', async () => {
    assert.equal((await handle(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }))).statusCode, 400);
    assert.equal((await handle(Object.assign(new Error('too big'), { type: 'entity.too.large' }))).statusCode, 413);
  });
  it('maps Prisma duplicate / missing / bad-reference errors to 409 / 404 / 400', async () => {
    const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' } as never);
    assert.equal((await handle(prismaError('P2002'))).statusCode, 409);
    assert.equal((await handle(prismaError('P2025'))).statusCode, 404);
    assert.equal((await handle(prismaError('P2003'))).statusCode, 400);
  });
  it('unknown errors become 500 and unknown routes 404', async () => {
    assert.equal((await handle(new Error('boom'))).statusCode, 500);
    const out = await invoke((req, res) => notFoundHandler(req, res), fakeReq());
    assert.equal(out.res.statusCode, 404);
  });
});
