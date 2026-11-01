import { isValidNationalId } from "@/lib/format";

import { cleanNationalId, NATIONAL_ID_MESSAGES, validateRequesterMobile } from "./patient-validation";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";

/**
 * سنجش ورودی فرم عمومی `/nobat`. بدون React و بدون سرور است، تا هم کلاینت پیش از ارسال و هم اکشن سرور
 * (که ورودی را دوباره می‌سنجد، چون ورودی کلاینت قابل اعتماد نیست) از همین یک تابع استفاده کنند.
 * هر پیام فارسی است و فقط اولین خطای هر فیلد برمی‌گردد.
 */

/** `form` خطایی است که به یک فیلد تعلق ندارد (مثل محدودیت نرخ). */
export type PublicBookingField = "fullName" | "nationalId" | "contactMobile" | "forSelf" | "dateKey" | "time" | "form";

export type PublicRequestErrors = Partial<Record<PublicBookingField, string>>;

export const PUBLIC_REQUEST_NAME_MAX_LENGTH = 100;

/** مقدارهای تمیزشده‌ای که به `request_appointment` می‌روند؛ `startsAt` یک لحظهٔ ISO با منطقهٔ زمانی است. */
export interface PublicRequestValues {
  fullName: string;
  nationalId: string;
  contactMobile: string;
  forSelf: boolean;
  startsAt: string;
}

export type PublicRequestValidation = { ok: true; values: PublicRequestValues } | { ok: false; errors: PublicRequestErrors };

/** همان قالبی که PostgREST برای `timestamptz` برمی‌گرداند؛ بدون منطقهٔ زمانی رد می‌شود، چون به منطقهٔ سرور وابسته می‌شد. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** `now` را آزمون‌ها می‌دهند؛ ساعتی که گذشته باشد همان «دیگر خالی نیست» است. */
export function validatePublicRequest(input: unknown, now: Date = new Date()): PublicRequestValidation {
  const raw = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const errors: PublicRequestErrors = {};

  const fullName = asText(raw.fullName).trim().replace(/\s+/g, " ");
  if (!fullName) {
    errors.fullName = messages.nameEmpty;
  } else if (fullName.length > PUBLIC_REQUEST_NAME_MAX_LENGTH) {
    errors.fullName = messages.nameTooLong;
  }

  const nationalId = cleanNationalId(asText(raw.nationalId));
  if (nationalId === "") {
    errors.nationalId = NATIONAL_ID_MESSAGES.empty;
  } else if (/\D/.test(nationalId)) {
    errors.nationalId = NATIONAL_ID_MESSAGES.notDigits;
  } else if (nationalId.length !== 10) {
    errors.nationalId = NATIONAL_ID_MESSAGES.wrongLength(nationalId.length);
  } else if (!isValidNationalId(nationalId)) {
    errors.nationalId = NATIONAL_ID_MESSAGES.invalid;
  }

  const contact = validateRequesterMobile(asText(raw.contactMobile));
  if (!contact.ok) {
    errors.contactMobile = contact.message;
  }

  // «خودم / شخص دیگری» پیش‌فرض ندارد؛ فقط یک boolean واقعی پذیرفته می‌شود، نه رشتهٔ "false" یا خالی.
  if (typeof raw.forSelf !== "boolean") {
    errors.forSelf = messages.forSelfEmpty;
  }

  const startsAtText = asText(raw.startsAt).trim();
  const startsAtMs = ISO_INSTANT.test(startsAtText) ? Date.parse(startsAtText) : Number.NaN;
  if (startsAtText === "" || Number.isNaN(startsAtMs)) {
    errors.time = messages.timeEmpty;
  } else if (startsAtMs <= now.getTime()) {
    errors.time = messages.slotTaken;
  }

  if (Object.keys(errors).length > 0 || !contact.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      fullName,
      nationalId,
      contactMobile: contact.value,
      forSelf: raw.forSelf as boolean,
      startsAt: new Date(startsAtMs).toISOString(),
    },
  };
}
