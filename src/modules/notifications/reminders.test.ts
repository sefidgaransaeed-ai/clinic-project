import { describe, expect, it } from "vitest";
import {
  buildReminders,
  parseReminderHour,
  type ReminderAppointment,
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
    patientMobile: null,
    clinic: CLINIC,
    ...overrides,
  };
}

function link(overrides: Partial<ReminderLink> = {}): ReminderLink {
  return { platform: "telegram", chatId: "100", mobile: MOBILE, ...overrides };
}

function run(input: {
  now?: Date;
  reminderHour?: number;
  appointments?: ReminderAppointment[];
  links?: ReminderLink[];
  sentLog?: ReminderLogEntry[];
}) {
  return buildReminders({
    now: NOW,
    reminderHour: 18,
    appointments: [appointment()],
    links: [link()],
    sentLog: [],
    ...input,
  });
}

describe("parseReminderHour", () => {
  it.each([
    ["18", 18],
    ["0", 0],
    ["07", 7],
    ["23", 23],
    [" 9 ", 9],
  ])("عدد صحیح معتبر %j را می‌پذیرد", (value, expected) => {
    expect(parseReminderHour(value)).toBe(expected);
  });

  it.each([null, undefined, "", "  ", "24", "99", "-1", "7.5", "abc", "18h", "+5", "1e1", "۹"])(
    "مقدار نامعتبر %j به پیش‌فرض ۱۸ برمی‌گردد",
    (value) => {
      expect(parseReminderHour(value)).toBe(18);
    },
  );
});

describe("buildReminders — ساعت ارسال", () => {
  it("در ساعت درست یک پیام می‌دهد", () => {
    expect(run({})).toEqual([
      {
        platform: "telegram",
        chatId: "100",
        appointmentId: "a1",
        text: expect.any(String),
      },
    ]);
  });

  it("در ساعت درست هر دقیقه‌ای پیام می‌دهد", () => {
    expect(run({ now: new Date("2026-11-02T18:00:00+03:30") })).toHaveLength(1);
    expect(run({ now: new Date("2026-11-02T18:59:59+03:30") })).toHaveLength(1);
  });

  it("در ساعت نادرست فهرست خالی می‌دهد", () => {
    expect(run({ now: new Date("2026-11-02T17:59:59+03:30") })).toEqual([]);
    expect(run({ now: new Date("2026-11-02T19:00:00+03:30") })).toEqual([]);
    expect(run({ reminderHour: 9 })).toEqual([]);
  });

  it("ساعت را به وقت تهران می‌سنجد نه UTC", () => {
    // ۱۴:۴۰ UTC همان ۱۸:۱۰ تهران است
    expect(run({ now: new Date("2026-11-02T14:40:00Z"), reminderHour: 18 })).toHaveLength(1);
    expect(run({ now: new Date("2026-11-02T14:40:00Z"), reminderHour: 14 })).toEqual([]);
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
    const result = run({ now, reminderHour: 1, appointments: [today, dayAfter] });
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
      appointments: [appointment({ requesterMobile: MOBILE, patientMobile: null })],
    });
    expect(result).toHaveLength(1);
  });

  it("با شمارهٔ شخصی مراجع تطبیق می‌دهد", () => {
    const result = run({
      appointments: [
        appointment({ requesterMobile: "09120000002", patientMobile: MOBILE }),
      ],
    });
    expect(result).toHaveLength(1);
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
      appointments: [appointment({ requesterMobile: "abc", patientMobile: null })],
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

  it("اگر هر دو شماره به یک لینک بخورند فقط یک پیام می‌رود", () => {
    const result = run({
      appointments: [appointment({ requesterMobile: MOBILE, patientMobile: MOBILE })],
    });
    expect(result).toHaveLength(1);
  });

  it("اگر دو شمارهٔ متفاوت به دو لینک بخورند، هر لینک یک پیام می‌گیرد", () => {
    const result = run({
      appointments: [appointment({ requesterMobile: MOBILE, patientMobile: "09120000002" })],
      links: [link({ chatId: "100", mobile: MOBILE }), link({ chatId: "200", mobile: "09120000002" })],
    });
    expect(result.map((r) => r.chatId)).toEqual(["100", "200"]);
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
