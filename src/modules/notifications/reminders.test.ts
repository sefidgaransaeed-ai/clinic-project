import { describe, expect, it } from "vitest";
import {
  buildReminders,
  deliverReminders,
  planReminders,
  tomorrowTehranRange,
  type Reminder,
  type ReminderAppointment,
  type ReminderDelivery,
  type ReminderLink,
  type ReminderLogEntry,
} from "./reminders";

// فقط داده ساختگی؛ شماره‌ها و نام‌ها واقعی نیستند. تهران +۰۳:۳۰ ثابت است.
// «اکنون» = ۲ نوامبر ۲۰۲۶ ساعت ۱۸:۱۰ تهران؛ فردا = ۳ نوامبر = ۱۲ آبان ۱۴۰۵.
const NOW = new Date("2026-11-02T18:10:00+03:30");
const TOMORROW_11_30 = "2026-11-03T11:30:00+03:30";
const MOBILE = "09120000001";
const CLINIC = { name: "مطب نمونه", address: "تهران، خیابان نمونه، پلاک ۱" };

function appointment(
  overrides: Partial<ReminderAppointment> = {},
): ReminderAppointment {
  return {
    id: "a1",
    startsAt: TOMORROW_11_30,
    status: "confirmed",
    requesterMobile: MOBILE,
    clinic: CLINIC,
    ...overrides,
  };
}

function link(overrides: Partial<ReminderLink> = {}): ReminderLink {
  return { platform: "telegram", chatId: "100", mobile: MOBILE, ...overrides };
}

function run(input: {
  now?: Date;
  appointments?: ReminderAppointment[];
  links?: ReminderLink[];
  sentLog?: ReminderLogEntry[];
}) {
  return buildReminders({
    now: NOW,
    appointments: [appointment()],
    links: [link()],
    sentLog: [],
    ...input,
  });
}

describe("buildReminders — ساعت اجرا", () => {
  it("یک پیام می‌دهد", () => {
    expect(run({})).toEqual([
      {
        platform: "telegram",
        chatId: "100",
        appointmentId: "a1",
        text: expect.any(String),
      },
    ]);
  });

  it("هر اجرا می‌فرستد؛ ساعت اجرا شرط نیست", () => {
    for (const time of ["2026-11-02T00:05:00+03:30", "2026-11-02T09:00:00+03:30", "2026-11-02T22:59:59+03:30"]) {
      expect(run({ now: new Date(time) })).toHaveLength(1);
    }
  });

  it("اجرای ۱۴:۳۰ UTC همان ۱۸:۰۰ تهران است و فردا ۳ نوامبر می‌شود", () => {
    expect(run({ now: new Date("2026-11-02T14:30:00Z") })).toHaveLength(1);
  });
});

describe("tomorrowTehranRange", () => {
  it("بازهٔ فردای تهران را به UTC می‌دهد", () => {
    expect(tomorrowTehranRange(NOW)).toEqual({
      from: "2026-11-02T20:30:00.000Z",
      to: "2026-11-03T20:30:00.000Z",
    });
  });

  it("وقتی روز تهران با روز UTC فرق دارد، «فردا» از تقویم تهران می‌آید", () => {
    // ۲۲:۰۰ UTC روز ۲ نوامبر = ۰۱:۳۰ بامداد ۳ نوامبر تهران؛ فردا ۴ نوامبر است
    expect(tomorrowTehranRange(new Date("2026-11-02T22:00:00Z"))).toEqual({
      from: "2026-11-03T20:30:00.000Z",
      to: "2026-11-04T20:30:00.000Z",
    });
  });

  it("از مرز ماه و سال می‌گذرد", () => {
    expect(tomorrowTehranRange(new Date("2026-12-31T10:00:00Z"))).toEqual({
      from: "2026-12-31T20:30:00.000Z",
      to: "2027-01-01T20:30:00.000Z",
    });
  });
});

describe("buildReminders — وضعیت نوبت", () => {
  it("فقط نوبت تأییدشده یادآوری می‌گیرد", () => {
    const others = ["requested", "cancelled", "completed", "no_show", "rejected", "expired", ""];
    const appointments = others.map((status, index) =>
      appointment({ id: `x${index}`, status }),
    );
    expect(run({ appointments })).toEqual([]);
    expect(run({ appointments: [...appointments, appointment({ id: "ok" })] })).toHaveLength(1);
  });
});

describe("buildReminders — مرز نیمه‌شب تهران", () => {
  it("نوبت ۰۰:۳۰ بامداد فردا (که در UTC هنوز امروز است) شمرده می‌شود", () => {
    const startsAt = "2026-11-03T00:30:00+03:30";
    expect(new Date(startsAt).toISOString().startsWith("2026-11-02")).toBe(true);
    expect(run({ appointments: [appointment({ startsAt })] })).toHaveLength(1);
  });

  it("نوبت ۲۳:۳۰ امشب شمرده نمی‌شود", () => {
    expect(
      run({ appointments: [appointment({ startsAt: "2026-11-02T23:30:00+03:30" })] }),
    ).toEqual([]);
  });

  it("نوبت ۲۳:۳۰ فردا شمرده می‌شود و ۰۰:۳۰ پس‌فردا نه", () => {
    expect(
      run({ appointments: [appointment({ startsAt: "2026-11-03T23:30:00+03:30" })] }),
    ).toHaveLength(1);
    expect(
      run({ appointments: [appointment({ startsAt: "2026-11-04T00:30:00+03:30" })] }),
    ).toEqual([]);
  });

  it("وقتی روز تهران با روز UTC فرق دارد، «فردا» از تقویم تهران می‌آید", () => {
    // ۲۲:۰۰ UTC روز ۲ نوامبر = ۰۱:۳۰ بامداد ۳ نوامبر تهران؛ فردا ۴ نوامبر است
    const now = new Date("2026-11-02T22:00:00Z");
    const dayAfter = appointment({ id: "ok", startsAt: "2026-11-04T10:00:00+03:30" });
    const today = appointment({ id: "no", startsAt: "2026-11-03T10:00:00+03:30" });
    const result = run({ now, appointments: [today, dayAfter] });
    expect(result.map((r) => r.appointmentId)).toEqual(["ok"]);
  });

  it("نوبت با تاریخ نامعتبر رد می‌شود و بقیه را خراب نمی‌کند", () => {
    const result = run({
      appointments: [appointment({ id: "bad", startsAt: "not-a-date" }), appointment({ id: "ok" })],
    });
    expect(result.map((r) => r.appointmentId)).toEqual(["ok"]);
  });
});

describe("buildReminders — تطبیق شماره", () => {
  it("با requester_mobile تطبیق می‌دهد", () => {
    const result = run({
      appointments: [appointment({ requesterMobile: MOBILE })],
    });
    expect(result).toHaveLength(1);
  });

  it("شمارهٔ شخصی مراجع را هدف نمی‌گیرد (سند ۰۰۱۲)", () => {
    // فیلد اضافه از راه متغیر می‌آید تا بررسی نوع، آن را رد نکند
    const withPatientMobile = {
      ...appointment({ requesterMobile: "09120000002" }),
      patientMobile: MOBILE,
    };
    expect(run({ appointments: [withPatientMobile] })).toEqual([]);
  });

  it("قالب‌های مختلف شماره را پیش از مقایسه یکدست می‌کند", () => {
    const result = run({
      appointments: [appointment({ requesterMobile: "+98 912 000 0001" })],
      links: [link({ mobile: "989120000001" })],
    });
    expect(result).toHaveLength(1);
  });

  it("شمارهٔ دیگر را تطبیق نمی‌دهد", () => {
    expect(run({ links: [link({ mobile: "09120000009" })] })).toEqual([]);
  });

  it("هرگز با نام تطبیق نمی‌دهد", () => {
    const name = "ندا کیانی";
    // فیلد اضافه از راه متغیر می‌آید تا بررسی نوع، آن را رد نکند
    const withName = { ...appointment({ requesterMobile: "09120000002" }), patientName: name };
    const linkWithName = { ...link({ mobile: "09120000009" }), name };
    expect(run({ appointments: [withName], links: [linkWithName] })).toEqual([]);
  });

  it("شمارهٔ نامعتبر یا خالی با شمارهٔ نامعتبر دیگر یکی نمی‌شود", () => {
    const result = run({
      appointments: [appointment({ requesterMobile: "abc" })],
      links: [link({ mobile: "abc" }), link({ mobile: "" })],
    });
    expect(result).toEqual([]);
  });

  it("دو چت وصل به یک شماره، هرکدام یک پیام می‌گیرند", () => {
    const result = run({
      links: [
        link({ platform: "telegram", chatId: "100" }),
        link({ platform: "telegram", chatId: "200" }),
        link({ platform: "bale", chatId: "300" }),
      ],
    });
    expect(result.map((r) => `${r.platform}:${r.chatId}`)).toEqual([
      "telegram:100",
      "telegram:200",
      "bale:300",
    ]);
  });

  it("فقط لینکِ هم‌شمارهٔ requester_mobile پیام می‌گیرد", () => {
    const result = run({
      links: [
        link({ chatId: "100", mobile: MOBILE }),
        link({ chatId: "200", mobile: "09120000002" }),
      ],
    });
    expect(result.map((r) => r.chatId)).toEqual(["100"]);
  });

  it("دو نوبت فردا برای یک چت، دو پیام جدا می‌شود", () => {
    const result = run({
      appointments: [
        appointment({ id: "a1", startsAt: "2026-11-03T10:00:00+03:30" }),
        appointment({ id: "a2", startsAt: "2026-11-03T15:30:00+03:30" }),
      ],
    });
    expect(result.map((r) => r.appointmentId)).toEqual(["a1", "a2"]);
    expect(result[0].text).toContain("۱۰:۰۰");
    expect(result[1].text).toContain("۱۵:۳۰");
  });

  it("لینک تکراری در ورودی پیام تکراری نمی‌سازد", () => {
    expect(run({ links: [link(), link()] })).toHaveLength(1);
  });
});

describe("buildReminders — لاگ ارسال", () => {
  it.each(["sent", "failed", "no_link"] as const)(
    "با ثبت %s در لاگ دوباره نمی‌فرستد",
    (result) => {
      expect(
        run({ sentLog: [{ appointmentId: "a1", platform: "telegram", result }] }),
      ).toEqual([]);
    },
  );

  it("لاگ فقط همان جفت (نوبت، پلتفرم) را می‌بندد", () => {
    const result = run({
      appointments: [appointment({ id: "a1" }), appointment({ id: "a2" })],
      links: [link({ platform: "telegram" }), link({ platform: "bale", chatId: "300" })],
      sentLog: [{ appointmentId: "a1", platform: "telegram", result: "sent" }],
    });
    expect(result.map((r) => `${r.appointmentId}:${r.platform}`)).toEqual([
      "a1:bale",
      "a2:telegram",
      "a2:bale",
    ]);
  });
});

describe("buildReminders — متن پیام", () => {
  const [{ text }] = run({});

  it("یادآوری است و تاریخ شمسی، ساعت، نام و نشانی مطب را دارد", () => {
    expect(text).toMatch(/^یادآوری نوبت/);
    expect(text).toContain("۱۲ آبان ۱۴۰۵");
    expect(text).toContain("۱۱:۳۰");
    expect(text).toContain(`مطب: ${CLINIC.name}`);
    expect(text).toContain(`نشانی: ${CLINIC.address}`);
  });

  it("بدون مطب، سطرهای مطب نمی‌آید", () => {
    const [reminder] = run({ appointments: [appointment({ clinic: null })] });
    expect(reminder.text).toContain("۱۲ آبان ۱۴۰۵");
    expect(reminder.text).not.toContain("مطب");
    expect(reminder.text).not.toContain("نشانی");
  });

  it("نام مراجع در متن نیست", () => {
    const name = "ندا کیانی";
    const withName = { ...appointment(), patientName: name };
    const [reminder] = run({ appointments: [withName] });
    expect(reminder.text).not.toContain("ندا");
    expect(reminder.text).not.toContain("کیانی");
  });

  it("توصیهٔ پزشکی و پیشنهاد ثبت یا تغییر نوبت ندارد", () => {
    const forbidden = [
      "دارو", "درمان", "تشخیص", "توصیه", "مصرف", "ورزش", "ناشتا", "قرص",
      "تغییر", "لغو", "جابه‌جا", "بگیرید", "ثبت", "رزرو",
    ];
    for (const word of forbidden) {
      expect(text).not.toContain(word);
    }
  });
});

describe("planReminders", () => {
  const base = {
    now: NOW,
    appointments: [appointment({ id: "a1" }), appointment({ id: "a2" })],
    links: [link()],
  };

  it("بدون لاگ همه می‌روند و هیچ‌کدام کنار نمی‌رود", () => {
    const plan = planReminders({ ...base, sentLog: [] });
    expect(plan.reminders.map((r) => r.appointmentId)).toEqual(["a1", "a2"]);
    expect(plan.alreadySent).toBe(0);
  });

  it("جفتی که پیش‌تر sent دارد کنار می‌رود و شمرده می‌شود", () => {
    const plan = planReminders({
      ...base,
      sentLog: [{ appointmentId: "a1", platform: "telegram", result: "sent" }],
    });
    expect(plan.reminders.map((r) => r.appointmentId)).toEqual(["a2"]);
    expect(plan.alreadySent).toBe(1);
  });

  it("لاگ پیام‌رسان دیگر یا نوبت غیرفردا چیزی را کنار نمی‌گذارد", () => {
    const plan = planReminders({
      ...base,
      sentLog: [
        { appointmentId: "a1", platform: "bale", result: "sent" },
        { appointmentId: "zzz", platform: "telegram", result: "sent" },
      ],
    });
    expect(plan.reminders).toHaveLength(2);
    expect(plan.alreadySent).toBe(0);
  });
});

describe("deliverReminders", () => {
  function reminder(id: string): Reminder {
    return { platform: "telegram", chatId: "100", appointmentId: id, text: "متن ساختگی" };
  }

  function fakeDelivery(
    overrides: Partial<ReminderDelivery> = {},
  ): ReminderDelivery & { logged: ReminderLogEntry[]; sentIds: string[] } {
    const logged: ReminderLogEntry[] = [];
    const sentIds: string[] = [];
    return {
      logged,
      sentIds,
      send: async (r) => {
        sentIds.push(r.appointmentId);
        return true;
      },
      log: async (entry) => {
        logged.push(entry);
        return "saved";
      },
      ...overrides,
    };
  }

  it("پیام موفق را sent ثبت می‌کند", async () => {
    const delivery = fakeDelivery();
    const counts = await deliverReminders([reminder("a1"), reminder("a2")], delivery);
    expect(counts).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(delivery.logged.map((e) => e.result)).toEqual(["sent", "sent"]);
    expect(delivery.sentIds).toEqual(["a1", "a2"]);
  });

  it("ارسال ناموفق را failed ثبت می‌کند و بقیه ادامه می‌یابند", async () => {
    const delivery = fakeDelivery({
      send: async (r) => r.appointmentId !== "a1",
    });
    const counts = await deliverReminders([reminder("a1"), reminder("a2")], delivery);
    expect(counts).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(delivery.logged.map((e) => `${e.appointmentId}:${e.result}`)).toEqual([
      "a1:failed",
      "a2:sent",
    ]);
  });

  it("تلاش دوباره نمی‌کند: هر پیام یک‌بار فرستاده می‌شود", async () => {
    let calls = 0;
    const delivery = fakeDelivery({
      send: async () => {
        calls += 1;
        return false;
      },
    });
    await deliverReminders([reminder("a1")], delivery);
    expect(calls).toBe(1);
  });

  it("پرتاب‌شدن در ارسال هم failed حساب می‌شود و اجرا را نمی‌شکند", async () => {
    const delivery = fakeDelivery({
      send: async (r) => {
        if (r.appointmentId === "a1") {
          throw new Error("boom");
        }
        return true;
      },
    });
    const counts = await deliverReminders([reminder("a1"), reminder("a2")], delivery);
    expect(counts).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(delivery.logged[0]).toMatchObject({ appointmentId: "a1", result: "failed" });
  });

  it("درج تکراری sent یعنی «پیش‌تر فرستاده شده»: skipped، نه خطا", async () => {
    const delivery = fakeDelivery({ log: async () => "duplicate" });
    const counts = await deliverReminders([reminder("a1")], delivery);
    expect(counts).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  it("خطای ثبت لاگ اجرا را نمی‌شکند", async () => {
    const delivery = fakeDelivery({
      log: async (entry) => {
        if (entry.appointmentId === "a1") {
          throw new Error("boom");
        }
        return "saved";
      },
    });
    const counts = await deliverReminders([reminder("a1"), reminder("a2")], delivery);
    expect(counts).toEqual({ sent: 2, failed: 0, skipped: 0 });
  });

  it("فهرست خالی شمارش صفر می‌دهد و چیزی نمی‌فرستد", async () => {
    const delivery = fakeDelivery();
    expect(await deliverReminders([], delivery)).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(delivery.sentIds).toEqual([]);
  });

  it("شمارش فقط عدد است؛ شماره و متن در نتیجه نمی‌آید", async () => {
    const counts = await deliverReminders([reminder("a1")], fakeDelivery());
    expect(Object.keys(counts).sort()).toEqual(["failed", "sent", "skipped"]);
    expect(Object.values(counts).every((v) => typeof v === "number")).toBe(true);
  });
});
