import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * آزمون هم‌زمانی نوبت روی **پایگاه دادهٔ واقعی** — کار p2-10، معیارهای A-01 تا A-03.
 *
 * قید «دو نوبت فعال هم‌پوشان نمی‌شوند» (`appointments_no_overlap`) در خود Postgres است،
 * پس با mock ثابت نمی‌شود؛ این آزمون با ورود واقعی منشی به Supabase وصل می‌شود
 * (همان الگوی `tests/access/rls.test.ts`).
 *
 * چهار سناریو:
 *   ۱. دو تأیید هم‌زمان برای یک زمان (دو نشست جدا): دقیقاً یکی موفق، دیگری `23P01`.
 *   ۲. هم‌پوشانی جزئی (۵ دقیقه) رد می‌شود.
 *   ۳. پس از لغو، همان زمان دوباره قابل تأیید است.
 *   ۴. `request_appointment` برای روز تعطیل خطا می‌دهد.
 *
 * ⚠️ قواعد ایمنی:
 *  - بدون `TEST_SECRETARY_EMAIL` / `TEST_SECRETARY_PASSWORD` کل مجموعه رد می‌شود، نه اینکه شکست بخورد.
 *  - فقط روزی در سال بعد استفاده می‌شود که روز کاری برنامهٔ فعلی باشد، تعطیل نباشد و هیچ نوبت فعالی نداشته باشد.
 *  - فقط داده ساختگی: نام با «آزمون»، کد ملی ۳۰۰۰۰۰۰۱۵۱ و موبایل ۰۹۱۲۰۰۰۰۰۰۸.
 *  - در پایان همهٔ نوبت‌هایی که این آزمون ساخته لغو می‌شود (حذف ممنوع است)، حتی اگر آزمونی شکست بخورد.
 *  - برای (۴) هیچ تعطیلی ساخته نمی‌شود؛ از یک تعطیلی فعال موجود استفاده می‌شود و اگر نبود آزمون رد می‌شود.
 *
 * یک اثر جانبی ناگزیر: تأیید درخواستِ کد ملی ۳۰۰۰۰۰۰۱۵۱ (trigger `link_patient_on_confirm`) در اجرای اول
 * یک مراجعِ ساختگی «آزمون…» می‌سازد. مراجع حذف‌شدنی نیست، پس در اجراهای بعد همان دوباره استفاده می‌شود.
 *
 * صاحب این فایل: خانم مریم (`tests/appointments` طبق بخش ۳ CLAUDE.md).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretaryEmail = process.env.TEST_SECRETARY_EMAIL;
const secretaryPassword = process.env.TEST_SECRETARY_PASSWORD;

const hasCredentials = Boolean(url && anonKey && secretaryEmail && secretaryPassword);

const TEST_NAME = "آزمون هم‌زمانی نوبت";
const TEST_NATIONAL_ID = "3000000151";
const TEST_MOBILE = "09120000008";

const SLOT_MINUTES = 15;
/** ایران ساعت تابستانی ندارد و Asia/Tehran ثابت +۰۳:۳۰ است. */
const TEHRAN_OFFSET = "+03:30";
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** بازهٔ روزهایی که برای پیدا کردن یک روز خالی در سال بعد جست‌وجو می‌شود. */
const SEARCH_DAYS = 120;
/** پنجرهٔ کاری باید دست‌کم این‌قدر باشد تا سه سناریو در آن جا شوند. */
const MIN_WINDOW_MINUTES = 150;

/** هر سناریو ساعت خودش را دارد تا نتیجهٔ یکی روی دیگری اثر نگذارد (فاصله از ابتدای پنجرهٔ کاری، دقیقه). */
const OFFSET_SIMULTANEOUS = 0;
const OFFSET_PARTIAL_OVERLAP = 45;
const OFFSET_AFTER_CANCEL = 90;

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`ورود ${email} ناموفق بود: ${error.message}`);
  return client;
}

/** کلید تاریخ `YYYY-MM-DD` به وقت تهران. */
function tehranDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** شنبه = ۰ تا جمعه = ۶؛ همان `clinic_weekday` در پایگاه داده. */
function clinicWeekday(dateKey: string): number {
  const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay(); // یکشنبه = ۰
  return (dow + 1) % 7;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function instant(dateKey: string, minuteOfDay: number): Date {
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00${TEHRAN_OFFSET}`);
}

interface TestDay {
  dateKey: string;
  /** شروع پنجرهٔ کاری، دقیقه از نیمه‌شب تهران. */
  openMinute: number;
}

describe.skipIf(!hasCredentials)("نوبت هم‌زمان — قید هم‌پوشانی در پایگاه داده (A-01 تا A-03)", () => {
  let secretary: SupabaseClient;
  let secondSession: SupabaseClient;
  let anon: SupabaseClient;
  let day: TestDay | null = null;
  let noDayReason = "";
  const createdIds: string[] = [];

  /** روز کاریِ خالی در سال بعد؛ هرگز روزی که نوبت فعال یا تعطیلی دارد. */
  async function findEmptyWorkingDay(): Promise<{ day: TestDay | null; reason: string }> {
    const hours = await secretary
      .from("working_hours")
      .select("weekday, start_time, end_time")
      .eq("is_active", true);
    if (hours.error) throw new Error(`خواندن ساعت کاری ناموفق بود: ${hours.error.message}`);

    const closures = await secretary.from("closures").select("closure_date").eq("is_active", true);
    if (closures.error) throw new Error(`خواندن تعطیلی‌ها ناموفق بود: ${closures.error.message}`);
    const closedDays = new Set((closures.data ?? []).map((row) => row.closure_date as string));

    const start = new Date(Date.now() + 365 * DAY_MS);
    for (let i = 0; i < SEARCH_DAYS; i += 1) {
      const dateKey = tehranDateKey(new Date(start.getTime() + i * DAY_MS));
      if (closedDays.has(dateKey)) continue;

      const window = (hours.data ?? [])
        .filter((row) => row.weekday === clinicWeekday(dateKey))
        .map((row) => ({ open: toMinutes(row.start_time as string), close: toMinutes(row.end_time as string) }))
        .find((row) => row.close - row.open >= MIN_WINDOW_MINUTES);
      if (!window) continue;

      const busy = await secretary
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .gte("starts_at", instant(dateKey, 0).toISOString())
        .lt("starts_at", instant(dateKey, 24 * 60).toISOString());
      if (busy.error) throw new Error(`بررسی نوبت‌های روز ناموفق بود: ${busy.error.message}`);
      if ((busy.count ?? 0) > 0) continue;

      return { day: { dateKey, openMinute: window.open }, reason: "" };
    }
    return {
      day: null,
      reason: `در ${SEARCH_DAYS} روز پس از یک سال آینده روز کاریِ خالی و بدون تعطیلی با پنجرهٔ دست‌کم ${MIN_WINDOW_MINUTES} دقیقه پیدا نشد.`,
    };
  }

  /** یک درخواست «در انتظار» برای ساعت داده‌شده؛ درخواست‌ها جا را اشغال نمی‌کنند (A-03). */
  async function insertRequested(startMinuteOfDay: number): Promise<string> {
    const startsAt = instant(day!.dateKey, startMinuteOfDay);
    const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * MINUTE_MS);
    const { data, error } = await secretary
      .from("appointments")
      .insert({
        requester_name: TEST_NAME,
        requester_mobile: TEST_MOBILE,
        requester_national_id: TEST_NATIONAL_ID,
        requested_for_self: true,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "requested",
        source: "site",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`ساخت درخواست آزمون ناموفق بود: ${error?.message ?? "بدون پاسخ"}`);
    createdIds.push(data.id as string);
    return data.id as string;
  }

  function confirm(client: SupabaseClient, id: string) {
    return client.from("appointments").update({ status: "confirmed" }).eq("id", id).eq("status", "requested").select("id");
  }

  function cancel(client: SupabaseClient, id: string) {
    return client
      .from("appointments")
      .update({ status: "cancelled", cancel_reason: "cancelled" })
      .eq("id", id)
      .neq("status", "cancelled")
      .select("id");
  }

  async function statusOf(id: string): Promise<string> {
    const { data, error } = await secretary.from("appointments").select("status").eq("id", id).single();
    if (error || !data) throw new Error(`خواندن وضعیت نوبت ناموفق بود: ${error?.message ?? "بدون پاسخ"}`);
    return data.status as string;
  }

  beforeAll(async () => {
    secretary = await signedIn(secretaryEmail!, secretaryPassword!);
    secondSession = await signedIn(secretaryEmail!, secretaryPassword!);
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const found = await findEmptyWorkingDay();
    day = found.day;
    noDayReason = found.reason;
  }, 60_000);

  // حتی اگر آزمونی شکست بخورد، هر نوبتی که ساخته شد لغو می‌شود. حذف نمی‌کنیم.
  afterAll(async () => {
    if (!secretary || createdIds.length === 0) return;
    const { error } = await secretary
      .from("appointments")
      .update({ status: "cancelled", cancel_reason: "cancelled" })
      .in("id", createdIds)
      .neq("status", "cancelled");
    if (error) {
      console.error(`لغو نوبت‌های آزمون ناموفق بود (دستی لغو شوند): ${createdIds.join(", ")} — ${error.message}`);
    }
  }, 30_000);

  it("۱. دو تأیید هم‌زمان برای یک زمان: دقیقاً یکی موفق و دیگری 23P01 (A-02)", async (ctx) => {
    if (!day) ctx.skip(noDayReason);
    const minute = day!.openMinute + OFFSET_SIMULTANEOUS;

    // دو درخواست برای دقیقاً یک زمان؛ هر دو ثبت می‌شوند چون درخواست جا را اشغال نمی‌کند (A-03).
    const first = await insertRequested(minute);
    const second = await insertRequested(minute);

    const results = await Promise.all([confirm(secretary, first), confirm(secondSession, second)]);

    const succeeded = results.filter((result) => !result.error && result.data?.length === 1);
    const failed = results.filter((result) => result.error);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error?.code).toBe("23P01");

    const statuses = [await statusOf(first), await statusOf(second)].sort();
    expect(statuses).toEqual(["confirmed", "requested"]);
  }, 30_000);

  it("۲. هم‌پوشانی جزئی با نوبت تأییدشده رد می‌شود (A-01)", async (ctx) => {
    if (!day) ctx.skip(noDayReason);
    const minute = day!.openMinute + OFFSET_PARTIAL_OVERLAP;

    const existing = await insertRequested(minute);
    const confirmedExisting = await confirm(secretary, existing);
    expect(confirmedExisting.error).toBeNull();

    // شروع ۱۰ دقیقه بعد از نوبت اول (۱۵ دقیقه‌ای)، یعنی فقط ۵ دقیقه هم‌پوشانی از ته.
    const overlapsEnd = await insertRequested(minute + SLOT_MINUTES - 5);
    const afterEnd = await confirm(secretary, overlapsEnd);
    expect(afterEnd.error?.code).toBe("23P01");
    expect(await statusOf(overlapsEnd)).toBe("requested");

    // پایان ۵ دقیقه بعد از شروع نوبت اول، یعنی ۵ دقیقه هم‌پوشانی از سر.
    const overlapsStart = await insertRequested(minute - (SLOT_MINUTES - 5));
    const beforeStart = await confirm(secretary, overlapsStart);
    expect(beforeStart.error?.code).toBe("23P01");
    expect(await statusOf(overlapsStart)).toBe("requested");

    expect(await statusOf(existing)).toBe("confirmed");
  }, 30_000);

  it("۳. پس از لغو، همان زمان دوباره قابل تأیید است", async (ctx) => {
    if (!day) ctx.skip(noDayReason);
    const minute = day!.openMinute + OFFSET_AFTER_CANCEL;

    const holder = await insertRequested(minute);
    const waiting = await insertRequested(minute);

    expect((await confirm(secretary, holder)).error).toBeNull();

    // تا وقتی نوبت اول فعال است، دومی تأیید نمی‌شود.
    const blocked = await confirm(secretary, waiting);
    expect(blocked.error?.code).toBe("23P01");

    const cancelled = await cancel(secretary, holder);
    expect(cancelled.error).toBeNull();
    expect(await statusOf(holder)).toBe("cancelled");

    // لغو جا را آزاد می‌کند.
    const retry = await confirm(secretary, waiting);
    expect(retry.error).toBeNull();
    expect(retry.data).toHaveLength(1);
    expect(await statusOf(waiting)).toBe("confirmed");
  }, 30_000);

  it("۴. request_appointment برای روز تعطیل خطا می‌دهد", async (ctx) => {
    // هیچ تعطیلی ساخته نمی‌شود؛ فقط از یک تعطیلی فعالِ موجود استفاده می‌شود.
    const closure = await secretary
      .from("closures")
      .select("closure_date")
      .eq("is_active", true)
      .order("closure_date", { ascending: false })
      .limit(1);
    expect(closure.error).toBeNull();
    const closureDate = closure.data?.[0]?.closure_date as string | undefined;
    if (!closureDate) ctx.skip("هیچ تعطیلی فعالی در پایگاه داده نیست؛ این آزمون بدون ساختن تعطیلی اجرا نمی‌شود.");

    // ساعت ۱۰ صبح تهران؛ بررسی تعطیلی پیش از هر ثبتی انجام می‌شود، پس چیزی ساخته نمی‌شود.
    const startsAt = instant(closureDate!, 10 * 60).toISOString();
    const { data, error } = await anon.rpc("request_appointment", {
      p_name: TEST_NAME,
      p_mobile: TEST_MOBILE,
      p_national_id: TEST_NATIONAL_ID,
      p_starts_at: startsAt,
      p_for_self: true,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.message).toContain("این روز تعطیل است");
  }, 30_000);
});
