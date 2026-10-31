import { existsSync } from 'node:fs';

/**
 * متغیرهای .env.local را برای آزمون‌ها بارگذاری می‌کند.
 *
 * آزمون‌های `tests/access` با ورود واقعی به Supabase کار می‌کنند و بدون
 * این کلیدها خودشان را رد می‌کنند (نه اینکه شکست بخورند). پس روی سیستم
 * کسی که `.env.local` ندارد هم `npm test` سبز می‌ماند.
 */
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}
