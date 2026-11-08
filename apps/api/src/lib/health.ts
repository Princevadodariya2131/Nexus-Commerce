/**
 * Readiness probe: can this instance serve traffic (is the database reachable)?
 * Liveness (`GET /api/v1/health`) deliberately does NOT touch the database, so a
 * database outage makes the instance "not ready" without causing restart loops.
 */
export interface ProbeTarget {
  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): PromiseLike<unknown>;
}

export interface ReadinessResult {
  ok: boolean;
  checks: { database: 'up' | 'down' };
}

export async function checkReadiness(db: ProbeTarget, timeoutMs = 3000): Promise<ReadinessResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve(db.$queryRaw`SELECT 1`),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('database probe timed out')), timeoutMs);
      }),
    ]);
    return { ok: true, checks: { database: 'up' } };
  } catch {
    return { ok: false, checks: { database: 'down' } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
