// اسکریپت فقط برای توسعهٔ محلی: مسیر /api/bale را بدون هیچ ارتباطی با بلهٔ واقعی می‌آزماید.
// یک سرور جعلی روی 127.0.0.1 جای tapi.bale.ai می‌نشیند، یک «next dev» با توکن ساختگی و
// رمز تصادفی بالا می‌آید و پنج حالت به مسیر فرستاده می‌شود.
// اجرا: node src/modules/notifications/dev/fake-bale.mjs
//
// توکن ساختگی است و رمز هر بار تصادفی ساخته می‌شود؛ با این حال نشانی، توکن، رمز، متن پیام
// و شماره هیچ‌جا چاپ نمی‌شود. فقط نام هر حالت و نتیجه‌اش می‌آید.
// اگر next dev دیگری در همین پروژه باز باشد، باید اول بسته شود (Next قفل می‌گذارد).
//
// مثل poll.mjs عمداً process.exit صدا زده نمی‌شود؛ exitCode تنظیم می‌شود.

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../../../..");

const FAKE_TOKEN = "123:test";
const READY_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 60_000;

// شناسهٔ کاربر در پیام‌ها، و شناسه‌ای که با همان ۳۲ بیت کم‌ارزش ولی بزرگ‌تر از ۳۲ بیت است
const OWN_ID = 100_000_007;
const OVER_32_BIT_ID = OWN_ID + 2 ** 32;

class Exit extends Error {}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  throw new Exit();
}

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

function freePort() {
  return new Promise((done, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

// سرور جعلی بله: هر درخواست را ثبت می‌کند و پاسخ موفق می‌دهد.
const received = [];

function startFakeBale() {
  const server = createHttpServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      let body = null;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        // بدنهٔ غیر JSON؛ آزمون‌ها آن را رد می‌کنند
      }
      received.push({ method: req.method, path: req.url, body });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, result: {} }));
    });
  });
  return new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => done({ server, port: server.address().port }));
  });
}

let nextProcess;
let nextExited = false;
let nextOutput = "";
let secretForMasking = "";

function startNext(env, port) {
  const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  nextProcess = spawn(
    process.execPath,
    [nextBin, "dev", "-p", String(port), "-H", "127.0.0.1"],
    { cwd: projectRoot, env, shell: false, stdio: ["ignore", "pipe", "pipe"] },
  );
  const keep = (chunk) => {
    nextOutput = (nextOutput + chunk.toString("utf8")).slice(-4000);
  };
  nextProcess.stdout.on("data", keep);
  nextProcess.stderr.on("data", keep);
  nextProcess.on("exit", () => {
    nextExited = true;
  });
}

function stopNext() {
  if (!nextProcess || nextExited) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(nextProcess.pid), "/T", "/F"], { shell: false });
  } else {
    nextProcess.kill("SIGTERM");
  }
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

// خروجی next dev را بدون رمز چاپ می‌کند (برای وقتی که بالا نیامد).
function printNextOutput() {
  const masked = nextOutput.split(secretForMasking).join("***");
  console.error(masked.trim().split("\n").slice(-8).join("\n"));
}

let appBase = "";
let goodSecret = "";

function webhookPath(secret) {
  return secret === undefined
    ? "/api/bale"
    : `/api/bale?secret=${encodeURIComponent(secret)}`;
}

async function post(path, update) {
  const response = await fetch(`${appBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await response.arrayBuffer().catch(() => {});
  return response.status;
}

// تا وقتی مسیر کامپایل شود و هر پاسخی بدهد صبر می‌کند (اولین درخواست کند است).
async function waitUntilReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (nextExited) {
      printNextOutput();
      fail("next dev بالا نیامد؛ اگر نمونهٔ دیگری از آن باز است ببندیدش و دوباره اجرا کنید.");
    }
    try {
      await post(webhookPath("warmup"), { update_id: 0 });
      return;
    } catch {
      await sleep(500);
    }
  }
  printNextOutput();
  fail("next dev در زمان مقرر آماده نشد.");
}

function expect(condition, reason) {
  if (!condition) throw new Error(reason);
}

function textUpdate(text) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: OWN_ID },
      chat: { id: OWN_ID, type: "private" },
      text,
    },
  };
}

function contactUpdate(userId, phoneNumber) {
  return {
    update_id: 2,
    message: {
      message_id: 2,
      from: { id: OWN_ID },
      chat: { id: OWN_ID, type: "private" },
      contact: {
        phone_number: phoneNumber,
        first_name: "آزمون",
        ...(userId === undefined ? {} : { user_id: userId }),
      },
    },
  };
}

// دقیقاً یک sendMessage به توکن ساختگی و به همان گفتگو رسیده باشد.
function expectOneSend() {
  expect(received.length === 1, `انتظار یک پیام خروجی بود، ${received.length} رسید`);
  const [request] = received;
  expect(
    request.method === "POST" && request.path === `/bot${FAKE_TOKEN}/sendMessage`,
    "درخواست خروجی به sendMessage نبود",
  );
  expect(request.body?.chat_id === OWN_ID, "chat_id پیام خروجی درست نبود");
  return request.body;
}

function hasShareKeyboard(markup) {
  return markup?.keyboard?.[0]?.[0]?.request_contact === true;
}

const cases = [
  {
    name: "/start: دکمهٔ اشتراک شماره (بدون کلیدهای مستندنشدهٔ بله)",
    async run() {
      expect((await post(webhookPath(goodSecret), textUpdate("/start"))) === 200, "وضعیت ۲۰۰ نبود");
      const body = expectOneSend();
      expect(hasShareKeyboard(body.reply_markup), "دکمهٔ request_contact نبود");
      expect(
        !("resize_keyboard" in body.reply_markup) && !("one_time_keyboard" in body.reply_markup),
        "کلیدهای resize_keyboard یا one_time_keyboard برای بله فرستاده شد",
      );
    },
  },
  {
    name: "شمارهٔ خود کاربر: حساب وصل می‌شود",
    async run() {
      const update = contactUpdate(OWN_ID, "989120000001");
      expect((await post(webhookPath(goodSecret), update)) === 200, "وضعیت ۲۰۰ نبود");
      const body = expectOneSend();
      expect(body.text.includes("وصل شد"), "پیام «حساب وصل شد» نیامد");
      expect(body.reply_markup?.remove_keyboard === true, "کیبورد برداشته نشد");
    },
  },
  {
    name: "شمارهٔ شخص دیگر: رد می‌شود و دکمه می‌ماند",
    async run() {
      const update = contactUpdate(OWN_ID + 1, "989120000001");
      expect((await post(webhookPath(goodSecret), update)) === 200, "وضعیت ۲۰۰ نبود");
      const body = expectOneSend();
      expect(!body.text.includes("وصل شد"), "شمارهٔ شخص دیگر پذیرفته شد");
      expect(hasShareKeyboard(body.reply_markup), "دکمهٔ اشتراک شماره دوباره نیامد");
    },
  },
  {
    name: "رمز غلط یا نبود: ۴۰۱ و هیچ پیامی ارسال نمی‌شود",
    async run() {
      const update = textUpdate("/start");
      for (const secret of [undefined, "", "wrong-secret", goodSecret.slice(0, -1)]) {
        const status = await post(webhookPath(secret), update);
        expect(status === 401, `انتظار ۴۰۱ بود، ${status} رسید`);
      }
      expect(received.length === 0, "با رمز نادرست پیام ارسال شد");
    },
  },
  {
    name: "user_id بزرگ‌تر از ۳۲ بیت: رد می‌شود (مقایسهٔ سخت‌گیرانه)",
    async run() {
      const update = contactUpdate(OVER_32_BIT_ID, "989120000001");
      expect((await post(webhookPath(goodSecret), update)) === 200, "وضعیت ۲۰۰ نبود");
      const body = expectOneSend();
      expect(!body.text.includes("وصل شد"), "user_id بزرگ‌تر از ۳۲ بیت پذیرفته شد");
      expect(hasShareKeyboard(body.reply_markup), "دکمهٔ اشتراک شماره دوباره نیامد");
    },
  },
];

async function main() {
  refuseInProduction();

  goodSecret = randomBytes(16).toString("hex");
  secretForMasking = goodSecret;

  const fake = await startFakeBale();
  try {
    const appPort = await freePort();
    appBase = `http://127.0.0.1:${appPort}`;

    // این مقدارها بر هر چیزی در .env.local می‌چربند؛ next هیچ متغیر تنظیم‌شده‌ای را عوض نمی‌کند.
    startNext(
      {
        ...process.env,
        BALE_BOT_TOKEN: FAKE_TOKEN,
        BALE_WEBHOOK_SECRET: goodSecret,
        BALE_API_BASE_URL_DEV: `http://127.0.0.1:${fake.port}`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      appPort,
    );
    console.log("در حال بالا آوردن next dev (بار اول چند ثانیه طول می‌کشد)…");
    await waitUntilReady();

    let passed = 0;
    for (const testCase of cases) {
      received.length = 0;
      try {
        await testCase.run();
        passed += 1;
        console.log(`✓ ${testCase.name}`);
      } catch (error) {
        const reason = error instanceof Error && error.message ? error.message : describeError(error);
        console.error(`✗ ${testCase.name} — ${reason}`);
      }
    }
    console.log(`${passed} از ${cases.length} آزمون موفق بود.`);
    if (passed !== cases.length) process.exitCode = 1;
  } finally {
    stopNext();
    fake.server.closeAllConnections?.();
    fake.server.close();
  }
}

try {
  await main();
} catch (error) {
  if (!(error instanceof Exit)) {
    console.error(`خطای پیش‌بینی‌نشده (${describeError(error)})`);
    process.exitCode = 1;
  }
}
