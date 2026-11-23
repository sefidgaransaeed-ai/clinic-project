"use server";

import { fetchSlots, insertRequest } from "./public-booking-data";
import { isRealDateKey } from "./public-booking-days";
import { mapRequestError } from "./public-booking-errors";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";
import type { PublicClinicSlots } from "./public-booking-slots";
import { type PublicRequestErrors, validatePublicRequest } from "./public-booking-validation";

/**
 * اکشن‌های عمومی فرم `/nobat`. بازدیدکننده واردشده نیست، پس `requireRole` ندارند؛ در عوض هر ورودی دوباره سنجیده می‌شود
 * (ورودی کلاینت قابل اعتماد نیست) و پایگاه داده قواعد را جداگانه اجبار می‌کند. فقط با کلید anon کار می‌کنند.
 */

export type LoadSlotsResult = { ok: true; groups: PublicClinicSlots[] } | { ok: false; message: string };

export async function loadPublicSlots(dateKey: unknown): Promise<LoadSlotsResult> {
  if (!isRealDateKey(dateKey)) {
    return { ok: false, message: messages.dateInvalid };
  }
  const groups = await fetchSlots(dateKey);
  return groups ? { ok: true, groups } : { ok: false, message: messages.slotsFailed };
}

export type SubmitRequestResult = { ok: true } | { ok: false; errors: PublicRequestErrors };

export async function submitPublicRequest(input: unknown): Promise<SubmitRequestResult> {
  const validation = validatePublicRequest(input);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const result = await insertRequest(validation.values);
  if (result.ok) {
    return { ok: true };
  }

  const { field, message } = mapRequestError(result.error);
  return { ok: false, errors: { [field]: message } };
}
