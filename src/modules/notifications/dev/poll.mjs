// اسکریپت فقط برای توسعهٔ محلی: به‌جای وب‌هوک، با long-polling پیام‌های ربات تلگرام را
// می‌گیرد و هر update را به مسیر /api/telegram سرور محلی Next می‌فرستد. پردازش (data.ts
// واقعی و پایگاه داده) و ارسال پاسخ کار همان مسیر است، نه این اسکریپت.
//
// اجرا: دو ترمینال PowerShell جدا. در هر دو، پیش از هر چیز:
//   $env:HTTPS_PROXY="http://127.0.0.1:10808"
//   $env:NODE_USE_ENV_PROXY="1"
//   $env:NO_PROXY="127.0.0.1,localhost"
// ترمینال ۱:  npm run dev
// ترمینال ۲:  node src/modules/notifications/dev/poll.mjs [--delete-webhook]
//
// - پروکسی برای خود Next هم لازم است: sendMessage و Supabase از فرایند Next صدا زده
//   می‌شوند، نه از این اسکریپت. NO_PROXY هم باید باشد تا POST محلی از پروکسی رد نشود.
// - اگر برای ربات وب‌هوک تنظیم شده باشد، getUpdates با خطای ۴۰۹ رد می‌شود؛ یک بار با
//   --delete-webhook اجرا کنید (بعد از آزمون وب‌هوک سرور اصلی را دوباره تنظیم کنید).
// - توکن و رمز از .env.local خوانده می‌شوند. اگر Next روی پورتی جز ۳۰۰۰ بالا آمده،
//   متغیر POLL_TARGET_PORT را بگذارید. نشانی مقصد همیشه 127.0.0.1 است.
//
// توکن در نشانی درخواست‌هاست، پس هیچ‌جا نشانی، توکن، رمز، متن پیام، شماره یا chat_id
// چاپ نمی‌شود؛ فقط تعداد و کد وضعیت HTTP، و در خطاهای شبکه نام و کد خطا.
//
// عمداً process.exit صدا زده نمی‌شود: در ویندوز با Node 24 خروج اجباری هم‌زمان با
// بسته‌شدن سوکت‌ها گاهی با خطای libuv (کد 3221226505) کرش می‌کرد. به‌جایش exitCode
// تنظیم می‌شود و برنامه طبیعی تمام می‌شود.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../../../..");

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TOKEN_ENV = "TELEGRAM_BOT_TOKEN";
const SECRET_ENV = "TELEGRAM_WEBHOOK_SECRET";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const DEFAULT_TARGET_PORT = 3000;

const LONG_POLL_SECONDS = 30;
const LONG_POLL_TIMEOUT_MS = 45_000;
const SHORT_TIMEOUT_MS = 10_000;
const ACK_TIMEOUT_MS = 5_000;
// بار اول Next باید مسیر را کامپایل کند و Supabase هم از پروکسی می‌گذرد؛ زمان بده.
const FORWARD_TIMEOUT_MS = 30_000;
const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;
const REFUSED_PAUSE_MS = 3_000;
const RETRY_PAUSE_MS = 2_000;
// بعد از تلاش اول، حداکثر این‌قدر دوباره تلاش می‌شود و بعد update رد می‌شود.
const MAX_RETRIES = 3;

// برای خروج کنترل‌شده از هر نقطه؛ پیام و exitCode پیش‌تر تنظیم شده‌اند.
class Exit extends Error {}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  throw new Exit();
}

// فقط نام و کد خطا؛ message ممکن است نشانی (و در نتیجه توکن) را داشته باشد.
function describeError(error) {
  const name = error instanceof Error ? error.name : "Error";
  const code = error?.cause?.code ?? error?.code;
  return code ? `${name} ${code}` : name;
}

function refuseInProduction() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL !== undefined) {
    fail("این اسکریپت فقط برای توسعهٔ محلی است و روی محیط انتشار اجرا نمی‌شود.");
  }
}

function isConnectionRefused(error) {
  const cause = error?.cause;
  return (
    cause?.code === "ECONNREFUSED" ||
    cause?.errors?.some?.((inner) => inner?.code === "ECONNREFUSED") === true
  );
}

const stop = new AbortController();
let token;
let secret;
let targetUrl;
let backoffMs = BACKOFF_START_MS;
// برای «یک بار چاپ» در هر قطعی؛ با اولین پاسخ سرور دوباره آماده می‌شود.
let refusedPrinted = false;
const stats = { forwarded: 0, skipped: 0 };

function sleep(ms) {
  return new Promise((done) => {
    if (stop.signal.aborted) {
      done();
      return;
    }
    const timer = setTimeout(done, ms);
    stop.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        done();
      },
      { once: true },
    );
  });
}

// یک درخواست به API تلگرام؛ هیچ خطایی را پرتاب نمی‌کند و فقط نوع نتیجه را برمی‌گرداند.
async function telegram(method, body, { signal, timeoutMs }) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);

  let response;
  try {
    response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    if (signal?.aborted) return { kind: "aborted" };
    return { kind: "retry", code: describeError(error) };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // بدنهٔ ناقص یا غیر JSON؛ پایین‌تر با کد وضعیت طبقه‌بندی می‌شود
  }
  if (signal?.aborted) return { kind: "aborted" };

  if (response.ok && payload?.ok) return { kind: "ok", result: payload.result };
  if (response.status === 401 || response.status === 409) {
    return { kind: "fatal", status: response.status };
  }
  if (response.status === 429) {
    const seconds = Number(payload?.parameters?.retry_after);
    return { kind: "rate", seconds: seconds > 0 ? seconds : 1 };
  }
  return { kind: "retry", code: `HTTP ${response.status}` };
}

// تا موفقیت تلاش می‌کند؛ اگر اسکریپت در حال توقف باشد null برمی‌گرداند.
async function callWithRetry(method, body, timeoutMs) {
  while (!stop.signal.aborted) {
    const outcome = await telegram(method, body, {
      signal: stop.signal,
      timeoutMs,
    });
    switch (outcome.kind) {
      case "ok":
        backoffMs = BACKOFF_START_MS;
        return outcome.result;
      case "aborted":
        return null;
      case "fatal":
        if (outcome.status === 401) {
          fail(`تلگرام توکن را نپذیرفت (۴۰۱). مقدار ${TOKEN_ENV} را بررسی کنید.`);
        }
        fail(
          "تلگرام خطای ۴۰۹ داد: یا وب‌هوک فعال است یا نمونهٔ دیگری از این اسکریپت " +
            "در حال اجراست. آن را متوقف کنید و دوباره اجرا کنید.",
        );
        break;
      case "rate":
        console.error(`محدودیت نرخ تلگرام؛ ${outcome.seconds} ثانیه صبر می‌کنم.`);
        await sleep(outcome.seconds * 1000);
        break;
      default: {
        const wait = backoffMs;
        backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
        console.error(
          `خطا در ارتباط با تلگرام (${outcome.code}). ${wait / 1000} ثانیه بعد دوباره تلاش می‌کنم.`,
        );
        await sleep(wait);
      }
    }
  }
  return null;
}

// یک update را به سرور محلی می‌فرستد؛ هیچ خطایی را پرتاب نمی‌کند.
async function post(update) {
  let response;
  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify(update),
      signal: AbortSignal.any([AbortSignal.timeout(FORWARD_TIMEOUT_MS), stop.signal]),
    });
  } catch (error) {
    if (stop.signal.aborted) return { kind: "aborted" };
    if (isConnectionRefused(error)) return { kind: "refused" };
    return { kind: "error", label: describeError(error) };
  }
  // بدنهٔ پاسخ لازم نیست؛ بستنش اتصال را آزاد می‌کند.
  await response.body?.cancel().catch(() => {});

  refusedPrinted = false;
  if (response.status === 200) return { kind: "ok" };
  if (response.status === 401) return { kind: "unauthorized" };
  if (response.status === 400) return { kind: "bad" };
  return { kind: "error", label: `HTTP ${response.status}` };
}

// نتیجه: "advance" یعنی offset جلو برود، "stop" یعنی همین‌جا بایست و offset را جلو نبر.
async function forward(update) {
  let retries = 0;
  while (!stop.signal.aborted) {
    const outcome = await post(update);
    switch (outcome.kind) {
      case "ok":
        stats.forwarded += 1;
        console.log("یک update به سرور محلی رسید (HTTP 200).");
        return "advance";
      case "aborted":
        return "stop";
      case "refused":
        if (!refusedPrinted) {
          refusedPrinted = true;
          console.error(
            "سرور محلی در دسترس نیست. در ترمینال دیگر npm run dev را اجرا کنید؛ " +
              "هر ۳ ثانیه دوباره تلاش می‌کنم.",
          );
        }
        await sleep(REFUSED_PAUSE_MS);
        break;
      case "unauthorized":
        // offset جلو نمی‌رود تا این update بعد از درست‌شدن رمز دوباره برسد.
        console.error(
          `سرور محلی رمز را نپذیرفت (HTTP 401): مقدار ${SECRET_ENV} در .env.local با ` +
            "مقداری که Next بارگذاری کرده یکی نیست. رمز را درست کنید، npm run dev را " +
            "دوباره راه بیندازید و اسکریپت را از نو اجرا کنید.",
        );
        process.exitCode = 1;
        stop.abort();
        return "stop";
      case "bad":
        stats.skipped += 1;
        console.error("سرور محلی update را نپذیرفت (HTTP 400)؛ ردش کردم.");
        return "advance";
      default:
        if (retries >= MAX_RETRIES) {
          stats.skipped += 1;
          console.error(`ارسال به سرور محلی ناموفق ماند (${outcome.label})؛ این update را رد کردم.`);
          return "advance";
        }
        retries += 1;
        console.error(
          `ارسال به سرور محلی ناموفق بود (${outcome.label}). ${RETRY_PAUSE_MS / 1000} ثانیه بعد ` +
            `دوباره تلاش می‌کنم (${retries} از ${MAX_RETRIES}).`,
        );
        await sleep(RETRY_PAUSE_MS);
    }
  }
  return "stop";
}

// تأیید آخرین offset تا update‌های پردازش‌شده دوباره نیایند. شکست آن مهم نیست؛
// بدترین حالت این است که دفعهٔ بعد یک update دوباره بیاید.
async function acknowledge(offset) {
  if (offset === undefined) return;
  const outcome = await telegram(
    "getUpdates",
    { offset, limit: 1, timeout: 0, allowed_updates: ["message"] },
    { timeoutMs: ACK_TIMEOUT_MS },
  );
  if (outcome.kind !== "ok") {
    console.error("تأیید آخرین update ناموفق بود؛ ممکن است دفعهٔ بعد دوباره برسد.");
  }
}

function requestStop() {
  if (stop.signal.aborted) return;
  console.log("در حال توقف…");
  stop.abort();
}

async function main() {
  // ۱) روی محیط انتشار اجرا نشود
  refuseInProduction();

  // ۲) توکن و رمز از .env.local. loadEnvFile مقدارهای از قبل تنظیم‌شده را عوض نمی‌کند.
  try {
    process.loadEnvFile(join(projectRoot, ".env.local"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      fail(`خواندن فایل .env.local ناموفق بود (${describeError(error)}).`);
    }
  }
  refuseInProduction();

  token = process.env[TOKEN_ENV];
  if (!token) {
    fail(`متغیر ${TOKEN_ENV} تنظیم نشده است.`);
  }
  secret = process.env[SECRET_ENV];
  if (!secret) {
    fail(`متغیر ${SECRET_ENV} تنظیم نشده است.`);
  }

  const port = process.env.POLL_TARGET_PORT
    ? Number(process.env.POLL_TARGET_PORT)
    : DEFAULT_TARGET_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("مقدار POLL_TARGET_PORT یک پورت معتبر (عدد ۱ تا ۶۵۵۳۵) نیست.");
  }
  targetUrl = `http://127.0.0.1:${port}/api/telegram`;

  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  // وب‌هوک فعال با polling هم‌زمان کار نمی‌کند
  const webhook = await callWithRetry("getWebhookInfo", {}, SHORT_TIMEOUT_MS);
  if (webhook?.url) {
    if (!process.argv.includes("--delete-webhook")) {
      fail(
        "برای این ربات یک وب‌هوک فعال است و با polling هم‌زمان کار نمی‌کند. " +
          "اگر مطمئن هستید، با پرچم --delete-webhook دوباره اجرا کنید " +
          "(وب‌هوک حذف می‌شود و تا تنظیم دوباره، روی سرور اصلی کار نمی‌کند).",
      );
    }
    if ((await callWithRetry("deleteWebhook", {}, SHORT_TIMEOUT_MS)) !== null) {
      console.log("وب‌هوک حذف شد.");
    }
  }

  console.log(`دریافت پیام‌ها شروع شد؛ به پورت ${port} می‌فرستم (برای توقف Ctrl+C).`);

  let offset;
  while (!stop.signal.aborted) {
    const updates = await callWithRetry(
      "getUpdates",
      {
        ...(offset === undefined ? {} : { offset }),
        timeout: LONG_POLL_SECONDS,
        allowed_updates: ["message"],
      },
      LONG_POLL_TIMEOUT_MS,
    );
    if (updates === null) break;

    for (const update of updates) {
      if ((await forward(update)) === "stop") break;
      offset = update.update_id + 1;
    }
  }

  await acknowledge(offset);
  console.log(`متوقف شد (${stats.forwarded} update رسید، ${stats.skipped} update رد شد).`);
}

try {
  await main();
} catch (error) {
  if (!(error instanceof Exit)) {
    console.error(`خطای پیش‌بینی‌نشده (${describeError(error)})`);
    process.exitCode = 1;
  }
} finally {
  process.off("SIGINT", requestStop);
  process.off("SIGTERM", requestStop);
}
