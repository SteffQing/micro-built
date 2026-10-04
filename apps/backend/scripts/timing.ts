// Compares API latency through the frontend's /api rewrite with calling the API directly (V2.MD Stage 4).
// Reads, plus a write cycle that cleans up after itself: request a loan (POST), change its amount (PUT) and delete
// it (DELETE), then the same through the other route. It only runs for a CUSTOMER with no loan and nothing pending
// (with a running loan, POST would create a top-up), and deletes anything it created even if a call fails. Admins get
// a notification for each loan request. PATCH mark-read only marks your own notifications read.
//
//   SESSION_COOKIE='__Secure-better-auth.session_token=...; __Secure-better-auth.session_data=...' \
//     pnpm exec tsx scripts/timing.ts
//
// SESSION_COOKIE is the Cookie header copied from DevTools → Application → Cookies (a bare token value also
// works). FE_BASE / API_BASE / RUNS override the defaults. Nothing is printed except timings.

const FE = (process.env.FE_BASE ?? 'https://v2.microbuiltprime.com').replace(/\/$/, '');
const API = (process.env.API_BASE ?? 'https://api-v2.microbuiltprime.com').replace(/\/$/, '');
const RUNS = Number(process.env.RUNS ?? 5);

const raw = process.env.SESSION_COOKIE?.trim();
if (!raw) {
  console.error('Set SESSION_COOKIE (see the header of this file).');
  process.exit(1);
}
const cookie = raw.includes('=') ? raw : `__Secure-better-auth.session_token=${raw}`;

interface Case {
  label: string;
  method: 'GET' | 'PATCH';
  path: string;
}

const cases: Case[] = [
  { label: 'GET   /user', method: 'GET', path: '/user' },
  { label: 'GET   /user/overview', method: 'GET', path: '/user/overview' },
  { label: 'GET   /user/notifications', method: 'GET', path: '/user/notifications?limit=5' },
  { label: 'GET   /config', method: 'GET', path: '/config' },
  { label: 'PATCH /user/notifications/mark-read', method: 'PATCH', path: '/user/notifications/mark-read' },
];

async function send(
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ms: number; status: number; json: any }> {
  const started = performance.now();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { cookie, origin: FE, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const ms = performance.now() - started;
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { ms, status: res.status, json };
}

const time = (base: string, c: Case) => send(base, c.method, c.path, c.method === 'PATCH' ? {} : undefined);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (xs: number[]) => `${median(xs).toFixed(0)} ms (${Math.min(...xs).toFixed(0)}–${Math.max(...xs).toFixed(0)})`;

async function main() {
  console.log(`via frontend: ${FE}/api   direct: ${API}   runs: ${RUNS} (after 1 warm-up each)\n`);
  for (const c of cases) {
    const results: Record<string, number[]> = { proxy: [], direct: [] };
    const statuses = new Set<number>();
    for (const [name, base] of [
      ['proxy', `${FE}/api`],
      ['direct', API],
    ] as const) {
      await time(base, c); // warm-up: TLS, DNS, cold function
      for (let i = 0; i < RUNS; i++) {
        const r = await time(base, c);
        results[name].push(r.ms);
        statuses.add(r.status);
      }
    }
    const ok = statuses.size === 1 && [...statuses][0] < 300 ? '' : `   !! statuses ${[...statuses].join(',')}`;
    console.log(`${c.label.padEnd(38)} proxy ${fmt(results.proxy).padEnd(26)} direct ${fmt(results.direct)}${ok}`);
  }
}

/** One POST → PUT → DELETE cycle; returns each step's time. The loan is deleted even if a step fails. */
async function writeCycle(base: string): Promise<Record<'POST' | 'PUT' | 'DELETE', number> | null> {
  let loanId: string | undefined;
  try {
    const made = await send(base, 'POST', '/user/loan', { amount: 100000, category: 'PERSONAL' });
    loanId = made.json?.data?.loanId;
    if (![200, 201].includes(made.status) || !loanId) throw new Error(`POST /user/loan → ${made.status} ${made.json?.message ?? ''}`);
    const changed = await send(base, 'PUT', `/user/loan/${loanId}`, { amount: 120000 });
    if (changed.status !== 200) throw new Error(`PUT /user/loan/:id → ${changed.status} ${changed.json?.message ?? ''}`);
    const removed = await send(base, 'DELETE', `/user/loan/${loanId}`);
    if (removed.status !== 200) throw new Error(`DELETE /user/loan/:id → ${removed.status} ${removed.json?.message ?? ''}`);
    loanId = undefined;
    return { POST: made.ms, PUT: changed.ms, DELETE: removed.ms };
  } finally {
    if (loanId) {
      const cleaned = await send(base, 'DELETE', `/user/loan/${loanId}`);
      console.error(`cleanup: DELETE /user/loan/${loanId} → ${cleaned.status}`);
    }
  }
}

async function writes() {
  const me = await send(`${FE}/api`, 'GET', '/user');
  const overview = await send(`${FE}/api`, 'GET', '/user/overview');
  const data = overview.json?.data;
  const busy = !data || data.currentLoan || Object.values(data.pendingRequests ?? {}).some((n) => Number(n) > 0);
  if (me.json?.data?.role !== 'CUSTOMER' || busy) {
    console.log('\nwrites skipped: needs a CUSTOMER session with no loan and no pending requests');
    return;
  }
  console.log('\nwrite cycle (POST /user/loan → PUT → DELETE, deleted each time)');
  const collected = { proxy: { POST: [] as number[], PUT: [] as number[], DELETE: [] as number[] }, direct: { POST: [] as number[], PUT: [] as number[], DELETE: [] as number[] } };
  for (const [name, base] of [
    ['proxy', `${FE}/api`],
    ['direct', API],
  ] as const) {
    await writeCycle(base); // warm-up
    for (let i = 0; i < RUNS; i++) {
      const r = await writeCycle(base);
      if (r) for (const k of ['POST', 'PUT', 'DELETE'] as const) collected[name][k].push(r[k]);
    }
  }
  for (const k of ['POST', 'PUT', 'DELETE'] as const) {
    console.log(`${k.padEnd(38)} proxy ${fmt(collected.proxy[k]).padEnd(26)} direct ${fmt(collected.direct[k])}`);
  }
}

main().then(writes).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
