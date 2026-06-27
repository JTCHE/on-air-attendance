import type { Config } from '@netlify/functions';
import { pollAll } from '../../lib/poll.ts';

export const config: Config = { schedule: '*/5 * * * *' };

export default async function () {
  const token = process.env.CLUBCONNECT_TOKEN;
  if (!token) { console.error('CLUBCONNECT_TOKEN not set'); return; }
  try {
    const n = await pollAll(token);
    console.log(`[${new Date().toISOString()}] stored ${n} clubs`);
  } catch (err) {
    console.error(String(err)); // 401 → refresh CLUBCONNECT_TOKEN in Netlify env
  }
}
