import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * آزمون دسترسی روی **پایگاه دادهٔ واقعی** — لایهٔ RLS.
 *
 * این آزمون‌ها با ورود واقعی هر دو نقش اجرا می‌شوند و می‌سنجند که
 * قاعده‌های RLS همان کاری را بکنند که `docs/data-model.md` بخش ۹ می‌گوید.
 * عمداً هیچ چیزی را mock نمی‌کنند: قفلی که فقط در آزمون mock شده بسته
 * است، در واقعیت باز است.
 *
 * چرا جدا از آزمون مسیرهای پنل: آن یکی لایهٔ Next را می‌سنجد و به سرور
 * در حال اجرا نیاز دارد. این یکی لایهٔ پایگاه داده را می‌سنجد و مستقل از
 * برنامه کار می‌کند. اگر روزی کل برنامه را عوض کنیم، این آزمون باید
 * همچنان سبز بماند.
 *
 * ⚠️ بدون متغیرهای `.env.local` این آزمون‌ها رد می‌شوند، نه اینکه شکست
 * بخورند — تا `npm test` روی سیستم کسی که کلید ندارد قرمز نشود.
 *
 * صاحب این فایل: نفر اول (`tests/access` طبق بخش ۳ CLAUDE.md).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const doctorEmail = process.env.TEST_DOCTOR_EMAIL;
const doctorPassword = process.env.TEST_DOCTOR_PASSWORD;
const secretaryEmail = process.env.TEST_SECRETARY_EMAIL;
const secretaryPassword = process.env.TEST_SECRETARY_PASSWORD;

const hasCredentials = Boolean(
  url && anonKey && doctorEmail && doctorPassword && secretaryEmail && secretaryPassword,
);

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`ورود ${email} ناموفق بود: ${error.message}`);
  return client;
}

describe.skipIf(!hasCredentials)("دسترسی نقش‌ها در پایگاه داده", () => {
  let doctor: SupabaseClient;
  let secretary: SupabaseClient;
  let anon: SupabaseClient;

  beforeAll(async () => {
    doctor = await signedIn(doctorEmail!, doctorPassword!);
    secretary = await signedIn(secretaryEmail!, secretaryPassword!);
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
  }, 30_000);

  describe("گزارش مالی — H-4 و سند 0010", () => {
    it("پزشک می‌تواند گزارش مالی بگیرد", async () => {
      const { error } = await doctor.rpc("finance_report", {
        p_from: "2026-01-01",
        p_to: "2026-12-31",
      });
      expect(error).toBeNull();
    });

    it("منشی گزارش مالی نمی‌گیرد و پیام خطا فارسی است", async () => {
      const { error } = await secretary.rpc("finance_report", {
        p_from: "2026-01-01",
        p_to: "2026-12-31",
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("فقط برای پزشک");
    });
  });

  describe("فهرست پرداخت‌ها", () => {
    it("پزشک همهٔ پرداخت‌ها را می‌بیند", async () => {
      const { count, error } = await doctor
        .from("payments")
        .select("id", { count: "exact", head: true });
      expect(error).toBeNull();
      expect(count).toBeGreaterThan(0);
    });

    it("منشی فقط پرداخت‌های امروز را می‌بیند، نه همه", async () => {
      const all = await doctor.from("payments").select("id", { count: "exact", head: true });
      const mine = await secretary.from("payments").select("paid_at");

      expect(mine.error).toBeNull();
      expect(mine.data!.length).toBeLessThan(all.count!);

      // و هر چه می‌بیند باید واقعاً امروز به وقت تهران باشد
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      for (const row of mine.data!) {
        const rowDay = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tehran",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(row.paid_at as string));
        expect(rowDay).toBe(today);
      }
    });
  });

  describe("بازخوردها و ربات — فقط پزشک", () => {
    it("منشی هیچ ردیف نظرسنجی نمی‌بیند", async () => {
      const { data, error } = await secretary.from("surveys").select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("منشی هیچ ردیف اتصال ربات نمی‌بیند", async () => {
      const { data, error } = await secretary.from("bot_links").select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("کاربران", () => {
    it("منشی فقط ردیف خودش را در profiles می‌بیند", async () => {
      const { data, error } = await secretary.from("profiles").select("role");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].role).toBe("secretary");
    });

    it("پزشک همهٔ کاربران را می‌بیند", async () => {
      const { data, error } = await doctor.from("profiles").select("role");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(1);
    });
  });

  describe("حذف — برای هیچ نقشی مجاز نیست", () => {
    it("پزشک نمی‌تواند پرداخت حذف کند", async () => {
      const one = await doctor.from("payments").select("id").limit(1).single();
      const { error } = await doctor.from("payments").delete().eq("id", one.data!.id);
      const left = await doctor.from("payments").select("id").eq("id", one.data!.id);

      // RLS بدون policy حذف، ردیف را فیلتر می‌کند؛ پس یا خطا می‌دهد یا
      // بی‌صدا هیچ ردیفی را حذف نمی‌کند. هر دو حالت قبول است — آنچه مهم
      // است این است که ردیف **سر جایش بماند**.
      expect(error === null || error !== null).toBe(true);
      expect(left.data).toHaveLength(1);
    });

    it("پزشک نمی‌تواند مراجع حذف کند", async () => {
      const one = await doctor.from("patients").select("id").limit(1).single();
      await doctor.from("patients").delete().eq("id", one.data!.id);
      const left = await doctor.from("patients").select("id").eq("id", one.data!.id);
      expect(left.data).toHaveLength(1);
    });
  });

  describe("ویرایش پرداخت — مسدود است", () => {
    it("حتی پزشک هم مبلغ پرداخت را عوض نمی‌کند", async () => {
      const one = await doctor
        .from("payments")
        .select("id, amount_toman")
        .gt("amount_toman", 0)
        .limit(1)
        .single();

      await doctor
        .from("payments")
        .update({ amount_toman: 1 })
        .eq("id", one.data!.id);

      const after = await doctor
        .from("payments")
        .select("amount_toman")
        .eq("id", one.data!.id)
        .single();

      expect(after.data!.amount_toman).toBe(one.data!.amount_toman);
    });
  });

  describe("بازدیدکنندهٔ بدون حساب", () => {
    it("هیچ جدولی را نمی‌خواند", async () => {
      for (const table of ["patients", "payments", "appointments", "profiles"] as const) {
        const { error } = await anon.from(table).select("*").limit(1);
        expect(error, `جدول ${table} برای anon باز است`).not.toBeNull();
      }
    });

    it("اطلاعات عمومی سایت را می‌گیرد", async () => {
      const { data, error } = await anon.rpc("get_public_info");
      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("تابع انقضای درخواست‌ها را نمی‌تواند صدا بزند", async () => {
      const { error } = await anon.rpc("expire_stale_requests");
      expect(error).not.toBeNull();
    });
  });
});
