import { formatAppointmentTime } from "./date";

/**
 * ردیف‌های `available_slots(day)` را برای فهرست ساعت فرم عمومی آماده می‌کند، با گروه‌بندی بر اساس مطب.
 * فقط محاسبه است (بدون Supabase)، پس در آزمون هم کار می‌کند. نام و نشانی مطب همیشه از خود ردیف‌ها می‌آید، نه از متن ثابت.
 */

export interface PublicSlot {
  /** لحظهٔ ISO همان‌طور که پایگاه داده داده؛ همین مقدار به `p_starts_at` می‌رود. */
  startsAt: string;
  /** «۰۹:۳۰» به وقت تهران. */
  label: string;
}

export interface PublicClinicSlots {
  /** `null` یعنی ردیف مطب ندارد (برنامهٔ کاری قدیمی که `clinic_id` ندارد). */
  clinicId: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  slots: PublicSlot[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value !== "" ? value : null;
}

/** ردیف‌های ناجور کنار گذاشته می‌شوند. ترتیب گروه‌ها ترتیب اولین ساعتشان است و ترتیب ساعت‌ها همان ترتیب پایگاه داده. */
export function groupSlotsByClinic(rows: unknown): PublicClinicSlots[] {
  const groups = new Map<string, PublicClinicSlots>();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isRecord(row) || typeof row.starts_at !== "string" || Number.isNaN(Date.parse(row.starts_at))) {
      continue;
    }
    const clinicId = textOrNull(row.clinic_id);
    const key = clinicId ?? "";
    let group = groups.get(key);
    if (!group) {
      group = { clinicId, clinicName: textOrNull(row.clinic_name), clinicAddress: textOrNull(row.clinic_address), slots: [] };
      groups.set(key, group);
    }
    group.slots.push({ startsAt: row.starts_at, label: formatAppointmentTime(row.starts_at) });
  }

  return [...groups.values()];
}

/** مطب و ساعتِ انتخاب‌شده؛ پیام تأیید نشانی را از همین مطب می‌گیرد. */
export function findSlot(groups: PublicClinicSlots[], startsAt: string) {
  for (const group of groups) {
    const slot = group.slots.find((item) => item.startsAt === startsAt);
    if (slot) {
      return { group, slot };
    }
  }
  return null;
}
