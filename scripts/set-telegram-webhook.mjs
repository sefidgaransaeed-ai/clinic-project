// ثبت وبهوک ربات تلگرام روی سایت منتشرشده.
//
// چرا این اسکریپت هست: ربات تا وقتی تلگرام نداند پیام‌ها را کجا بفرستد، هیچ کاری
// نمی‌کند. ثبت وبهوک یک کار یک‌باره است و باید با همان `TELEGRAM_WEBHOOK_SECRET`
// انجام شود که روی سرور تنظیم شده؛ وگرنه مسیر /api/telegram همهٔ پیام‌ها را 401 رد می‌کند.
//
// اجرا (از ریشهٔ پروژه):
//   node scripts/set-telegram-webhook.mjs --info
//   node scripts/set-telegram-webhook.mjs --base https://your-app.vercel.app
//
// توکن و رمز از .env.local (یا متغیرهای محیطی) خوانده می‌شوند. اگر پشت پروکسی هستید:
//   $env:HTTPS_PROXY="http://127.0.0.1:10808"
//   $env:NODE_USE_ENV_PROXY="1"
//
// ⚠️ توکن در نشانی درخواست به تلگرام است. این اسکریپت هیچ‌جا توکن، رمز یا نشانی کامل
// وبهوک را چاپ نمی‌کند؛ فقط ok، تعداد pending و خطای کدشده.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function loadEnvFile() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    if (process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`متغیر ${name} تنظیم نشده است. آن را در .env.local بگذارید.`);
    process.exitCode = 1;
    process.exit();
  }
  return value;
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function call(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, ok: Boolean(json?.ok), result: json?.result, description: json?.description };
}

async function main() {
  loadEnvFile();
  const token = required("TELEGRAM_BOT_TOKEN");
  const secret = required("TELEGRAM_WEBHOOK_SECRET");

  const base = (arg("--base") ?? process.env.TELEGRAM_WEBHOOK_BASE_URL ?? "").replace(/\/+$/, "");

  if (process.argv.includes("--info") || !base) {
    const info = await call(token, "getWebhookInfo");
    if (!info.ok) {
      console.error(`getWebhookInfo ناموفق بود؛ HTTP ${info.status}، ${info.description ?? "بدون توضیح"}`);
      process.exitCode = 1;
      return;
    }
    const r = info.result ?? {};
    console.log(`وبهوک ثبت‌شده: ${r.url ? "بله" : "خیر"}`);
    if (r.url) console.log(`آخرین خطا: ${r.last_error_message ?? "ندارد"}`);
    console.log(`پیام‌های در انتظار: ${r.pending_update_count ?? 0}`);
    if (!base) {
      console.log("برای ثبت وبهوک، --base https://دومین-سایت را بدهید.");
    }
    return;
  }

  if (!/^https:\/\//.test(base)) {
    console.error("نشانی پایه باید با https:// شروع شود (تلگرام وبهوک http نمی‌پذیرد).");
    process.exitCode = 1;
    return;
  }

  const url = `${base}/api/telegram`;
  const result = await call(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });

  if (!result.ok) {
    console.error(`setWebhook ناموفق بود؛ HTTP ${result.status}، ${result.description ?? "بدون توضیح"}`);
    process.exitCode = 1;
    return;
  }
  console.log("وبهوک ثبت شد.");
  console.log(`تعداد پیام‌های در انتظار: ${result.result?.pending_update_count ?? 0}`);
}

main().catch((error) => {
  // فقط نام خطا؛ متن ممکن است نشانی (و در نتیجه توکن) داشته باشد.
  console.error(`خطای شبکه: ${error?.name ?? "unknown"}`);
  process.exitCode = 1;
});
