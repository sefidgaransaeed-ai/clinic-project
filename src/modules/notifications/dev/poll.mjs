// اسکریپت فقط برای توسعهٔ محلی: به‌جای وب‌هوک، با long-polling پیام‌های ربات تلگرام را
// می‌گیرد و به همان handleUpdate و sendMessage پروژه می‌دهد.
// اجرا: node src/modules/notifications/dev/poll.mjs [--delete-webhook]
//
// توکن در نشانی درخواست‌هاست، پس هیچ‌جا نشانی، توکن، متن پیام، شماره یا chat_id
// چاپ نمی‌شود؛ خطاها فقط با نام و کد می‌آیند.
//
// عمداً process.exit صدا زده نمی‌شود: در ویندوز با Node 24 خروج اجباری هم‌زمان با
// بسته‌شدن سوکت‌ها گاهی با خطای libuv (کد 3221226505) کرش می‌کرد. به‌جایش exitCode
// تنظیم می‌شود و برنامه طبیعی تمام می‌شود.

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../../../..");
const notificationsDir = resolve(here, "..");
const buildDir = join(projectRoot, "node_modules", ".cache", "clinic-bot-dev");

const LONG_POLL_SECONDS = 30;
const LONG_POLL_TIMEOUT_MS = 45_000;
const SHORT_TIMEOUT_MS = 10_000;
const ACK_TIMEOUT_MS = 5_000;
const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;

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

// handler.ts را با tsc خود پروژه می‌سازیم تا منطق آن کپی نشود. هر بار از نو ساخته
// می‌شود؛ package.json داخل پوشهٔ ساخت می‌گوید خروجی CommonJS است.
function buildBot() {
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(join(buildDir, "package.json"), '{"type":"commonjs"}\n');

  const tsc = spawnSync(
    process.execPath,
    [
      join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
      join(notificationsDir, "bot-handler.ts"),
      join(notificationsDir, "telegram-api.ts"),
      "--outDir", buildDir,
      "--rootDir", notificationsDir,
      "--module", "commonjs",
      "--moduleResolution", "node10",
      "--target", "es2022",
      "--lib", "es2022,dom",
      "--types", "node",
      "--strict",
      "--skipLibCheck",
      "--esModuleInterop",
      "--noEmitOnError",
    ],
    { cwd: projectRoot, encoding: "utf8", shell: false },
  );
  if (tsc.status !== 0) {
    console.error(tsc.stdout || describeError(tsc.error));
    fail("ساخت handler ربات ناموفق بود؛ خطاهای بالا را برطرف کنید.");
  }

  const require = createRequire(import.meta.url);
  const { handleUpdate } = require(join(buildDir, "bot-handler.js"));
  const { sendMessage, TELEGRAM_CONFIG } = require(join(buildDir, "telegram-api.js"));
  return { handleUpdate, sendMessage, config: TELEGRAM_CONFIG };
}

const stop = new AbortController();
let bot;
let token;
let backoffMs = BACKOFF_START_MS;

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

// یک درخواست به API؛ هیچ خطایی را پرتاب نمی‌کند و فقط نوع نتیجه را برمی‌گرداند.
async function telegram(method, body, { signal, timeoutMs }) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);

  let response;
  try {
    response = await fetch(`${bot.config.baseUrl}/bot${token}/${method}`, {
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
          fail("تلگرام توکن را نپذیرفت (۴۰۱). مقدار TELEGRAM_BOT_TOKEN را بررسی کنید.");
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

async function answer(update) {
  const id = update.update_id;
  try {
    const messages = await bot.handleUpdate(update, bot.config.platform);
    let allSent = true;
    for (const message of messages) {
      const result = await bot.sendMessage(message, bot.config);
      if (!result.ok) {
        allSent = false;
        console.error(
          `update ${id}: ارسال پیام ناموفق بود (${result.reason}${
            result.status ? ` ${result.status}` : ""
          })`,
        );
      }
    }
    if (allSent) console.log(`update ${id} answered`);
  } catch (error) {
    console.error(`update ${id}: پردازش ناموفق بود (${describeError(error)})`);
  }
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

  // ۲) ساخت handler
  bot = buildBot();

  // ۳) فقط توکن لازم است. loadEnvFile مقدارهای از قبل تنظیم‌شده را عوض نمی‌کند.
  try {
    process.loadEnvFile(join(projectRoot, ".env.local"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      fail(`خواندن فایل .env.local ناموفق بود (${describeError(error)}).`);
    }
  }
  refuseInProduction();

  token = process.env[bot.config.tokenEnv];
  if (!token) {
    fail(`متغیر ${bot.config.tokenEnv} تنظیم نشده است.`);
  }

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

  console.log("دریافت پیام‌ها شروع شد (برای توقف Ctrl+C).");

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
      await answer(update);
      // حتی اگر پردازش خطا داده باشد جلو می‌رود، وگرنه همان update تا ابد تکرار می‌شود
      offset = update.update_id + 1;
      if (stop.signal.aborted) break;
    }
  }

  await acknowledge(offset);
  console.log("متوقف شد");
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
