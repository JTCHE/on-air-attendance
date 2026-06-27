// Local collector — polls every club every 5 min into file:gym.db.
// Usage: bun scripts/collect.ts   (needs CLUBCONNECT_TOKEN in .env)

import { pollAll } from '../lib/poll';

const token = process.env.CLUBCONNECT_TOKEN;
if (!token) { console.error('Set CLUBCONNECT_TOKEN in .env'); process.exit(1); }

async function tick() {
  try {
    const n = await pollAll(token!);
    console.log(`[${new Date().toISOString()}] stored ${n} clubs`);
  } catch (err) {
    console.error(String(err));
  }
}

console.log(`Polling ${process.env.TURSO_URL ?? 'file:gym.db'} every 5 min`);
tick();
setInterval(tick, 5 * 60_000);
