import "server-only";

import { parsePublicInfo, type PublicBookingInfo } from "./public-booking-days";
import type { RequestErrorLike } from "./public-booking-errors";
import { createPublicClient } from "./public-booking-supabase";
import { groupSlotsByClinic, type PublicClinicSlots } from "./public-booking-slots";
import type { PublicRequestValues } from "./public-booking-validation";

/**
 * خواندن و نوشتن فرم عمومی `/nobat` فقط از راه سه تابع عمومی پایگاه داده. هیچ جدولی مستقیم خوانده نمی‌شود.
 * خطای پایگاه داده فقط کد و متنِ تابع را در لاگ سرور می‌گذارد (بدون ورودی بازدیدکننده)، و به بیرون نمی‌رسد.
 */

function logRpcError(name: string, error: RequestErrorLike) {
  console.error(`[nobat] ${name} failed`, error.code ?? "", error.message ?? "");
}

/** `null` یعنی گرفتن اطلاعات شکست خورد؛ صفحه پیام فارسی نشان می‌دهد. */
export async function fetchPublicInfo(): Promise<PublicBookingInfo | null> {
  try {
    const { data, error } = await createPublicClient().rpc("get_public_info");
    if (error) {
      logRpcError("get_public_info", error);
      return null;
    }
    return parsePublicInfo(data);
  } catch (error) {
    console.error("[nobat] get_public_info threw", error instanceof Error ? error.message : "");
    return null;
  }
}

/** `null` یعنی گرفتن ساعت‌ها شکست خورد؛ فهرست خالی یعنی روز تعطیل یا پر است. */
export async function fetchSlots(dateKey: string): Promise<PublicClinicSlots[] | null> {
  try {
    const { data, error } = await createPublicClient().rpc("available_slots", { day: dateKey });
    if (error) {
      logRpcError("available_slots", error);
      return null;
    }
    return groupSlotsByClinic(data);
  } catch (error) {
    console.error("[nobat] available_slots threw", error instanceof Error ? error.message : "");
    return null;
  }
}

export type InsertRequestResult = { ok: true } | { ok: false; error: RequestErrorLike };

/** `request_appointment` مطب را خودش از روی روز پر می‌کند و محدودیت نرخ را اجبار می‌کند. */
export async function insertRequest(values: PublicRequestValues): Promise<InsertRequestResult> {
  try {
    const { error } = await createPublicClient().rpc("request_appointment", {
      p_name: values.fullName,
      p_mobile: values.contactMobile,
      p_national_id: values.nationalId,
      p_starts_at: values.startsAt,
      p_for_self: values.forSelf,
    });
    if (error) {
      // خطاهای شناخته‌شده (محدودیت نرخ، ساعت پر) روال عادی‌اند و لاگ نمی‌خواهند.
      if (error.code !== "P0001") {
        logRpcError("request_appointment", error);
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch (error) {
    console.error("[nobat] request_appointment threw", error instanceof Error ? error.message : "");
    return { ok: false, error: {} };
  }
}
