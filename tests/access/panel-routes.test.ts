import { beforeAll, describe, expect, it } from "vitest";

import { PANEL_ROUTES } from "@/lib/panel-routes";

/**
 * آزمون دسترسی روی **مسیرهای Next** — لایهٔ بالای RLS.
 *
 * آزمون همسایه (`rls.test.ts`) می‌سنجد که پایگاه داده ردیف اشتباه
 * نمی‌دهد. این یکی می‌سنجد که کاربر اشتباه حتی به **صفحه** هم نمی‌رسد.
 *
 * ⚠️ این آزمون یک اشکال واقعی گرفت و برای همین نوشته شد.
 *
 * اول قفل نقش فقط در `requireRole` داخل خود صفحه بود. منو درست فیلتر
 * می‌شد و همه چیز سالم به نظر می‌رسید — ولی منشی روی هر پنج مسیر
 * فقط‌پزشک پاسخ **۲۰۰** می‌گرفت. دلیلش `cacheComponents` بود: Next پوستهٔ
 * صفحه را پیش از اجرای بدنه‌اش flush می‌کند، پس `redirect()` دیگر
 * نمی‌توانست کد وضعیت را عوض کند و `<title>` صفحهٔ فقط‌پزشک هم در پاسخ
 * می‌نشست. قفل به `src/proxy.ts` منتقل شد تا پیش از هر رندری اجرا شود.
 *
 * درس: قفل را از بیرون بسنجید، نه با خواندن کدش.
 *
 * برای اجرا سرور باید بالا باشد. اگر نبود، آزمون‌ها رد می‌شوند نه شکست:
 *
 *     npm run build && npm run start
 *     TEST_BASE_URL=http://localhost:3000 npm test
 *
 * صاحب این فایل: نفر اول (`tests/access` طبق بخش ۳ CLAUDE.md).
 */

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasCredentials = Boolean(
  url &&
    anonKey &&
    process.env.TEST_DOCTOR_EMAIL &&
    process.env.TEST_DOCTOR_PASSWORD &&
    process.env.TEST_SECRETARY_EMAIL &&
    process.env.TEST_SECRETARY_PASSWORD,
);

let serverUp = false;

/** کوکی‌ای می‌سازد که `@supabase/ssr` انتظار دارد — تکه‌تکه، اگر بلند شد. */
async function sessionCookie(email: string, password: string): Promise<string> {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey!, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json();
  if (!session.access_token) {
    throw new Error(`ورود ${email} ناموفق بود`);
  }

  const name = `sb-${new URL(url!).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const CHUNK = 3180;

  if (value.length <= CHUNK) return `${name}=${value}`;

  const parts: string[] = [];
  for (let i = 0; i * CHUNK < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

async function visit(path: string, cookie?: string) {
  const response = await fetch(BASE + path, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const location = response.headers.get("location");
  return {
    status: response.status,
    to: location ? new URL(location, BASE).pathname : null,
  };
}

const DOCTOR_ONLY = PANEL_ROUTES.filter((r) => !r.roles.includes("secretary")).map((r) => r.href);
const SHARED = PANEL_ROUTES.filter((r) => r.roles.includes("secretary")).map((r) => r.href);

beforeAll(async () => {
  try {
    await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(3000) });
    serverUp = true;
  } catch {
    serverUp = false;
  }
}, 10_000);

describe.skipIf(!hasCredentials)("دسترسی به مسیرهای پنل", () => {
  let doctorCookie: string;
  let secretaryCookie: string;

  beforeAll(async () => {
    if (!serverUp) return;
    doctorCookie = await sessionCookie(
      process.env.TEST_DOCTOR_EMAIL!,
      process.env.TEST_DOCTOR_PASSWORD!,
    );
    secretaryCookie = await sessionCookie(
      process.env.TEST_SECRETARY_EMAIL!,
      process.env.TEST_SECRETARY_PASSWORD!,
    );
  }, 30_000);

  it("کاربر واردنشده از هر مسیر پنل به صفحهٔ ورود می‌رود", async () => {
    if (!serverUp) return;
    for (const path of ["/panel", ...DOCTOR_ONLY, ...SHARED]) {
      expect(await visit(path), path).toEqual({ status: 307, to: "/login" });
    }
  }, 30_000);

  it("کاربر واردشده روی صفحهٔ ورود به پنل برمی‌گردد", async () => {
    if (!serverUp) return;
    expect(await visit("/login", secretaryCookie)).toEqual({ status: 307, to: "/panel" });
  });

  it("منشی به مسیرهای فقط‌پزشک نمی‌رسد — با ۳۰۷ واقعی، نه هدایت جریانی", async () => {
    if (!serverUp) return;
    for (const path of DOCTOR_ONLY) {
      expect(await visit(path, secretaryCookie), path).toEqual({
        status: 307,
        to: "/panel/no-access",
      });
    }
  }, 30_000);

  it("منشی به مسیرهای مشترک می‌رسد", async () => {
    if (!serverUp) return;
    for (const path of SHARED) {
      expect((await visit(path, secretaryCookie)).status, path).toBe(200);
    }
  }, 30_000);

  it("پزشک به همهٔ مسیرها می‌رسد", async () => {
    if (!serverUp) return;
    for (const path of [...DOCTOR_ONLY, ...SHARED]) {
      expect((await visit(path, doctorCookie)).status, path).toBe(200);
    }
  }, 30_000);

  it("منوی منشی هیچ آیتم فقط‌پزشک ندارد", async () => {
    if (!serverUp) return;
    const html = await (await fetch(`${BASE}/panel`, { headers: { cookie: secretaryCookie } })).text();
    for (const path of DOCTOR_ONLY) {
      expect(html, `${path} در منوی منشی دیده می‌شود`).not.toContain(`href="${path}"`);
    }
  }, 15_000);

  it("منوی پزشک همهٔ آیتم‌ها را دارد", async () => {
    if (!serverUp) return;
    const html = await (await fetch(`${BASE}/panel`, { headers: { cookie: doctorCookie } })).text();
    for (const route of PANEL_ROUTES) {
      expect(html, `${route.href} در منوی پزشک نیست`).toContain(`href="${route.href}"`);
    }
  }, 15_000);
});
