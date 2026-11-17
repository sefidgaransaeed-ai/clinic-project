"use server";

import { updateTag } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_INFO_TAG } from "./data";
import {
  cleanDraft,
  EDITABLE_KEYS,
  KEY_LABELS,
  validateDraft,
  type SettingsDraft,
  type SettingsErrors,
} from "./settings-rules";

export type SaveResult =
  | { ok: true; message: string; saved: SettingsDraft }
  | { ok: false; message: string; errors: SettingsErrors };

/**
 * ذخیرهٔ صفحهٔ «تنظیمات سایت» (کار p3-13).
 *
 * ⚠️ Server Action یک مسیر HTTP مستقل است و قفل proxy آن را نمی‌گیرد، پس خط اول requireRole است
 * (بند ۵ بخش ۷ CLAUDE.md). لایهٔ سوم RLS است: فقط پزشک این جدول‌ها را تغییر می‌دهد.
 *
 * سه جدول جدا نوشته می‌شوند و PostgREST تراکنش ندارد؛ اگر یکی نشد، پیامش می‌آید و بقیه که
 * نوشته شده‌اند می‌مانند. ذخیرهٔ دوباره بی‌خطر است، چون هر بار همهٔ پیش‌نویس نوشته می‌شود.
 */
export async function saveSiteSettings(draft: SettingsDraft): Promise<SaveResult> {
  await requireRole(["doctor"]);

  // قاعده‌ها دوباره همین‌جا اجرا می‌شوند؛ پیام‌های مرورگر قابل دور زدن‌اند
  const clean = cleanDraft(draft);
  const errors = validateDraft(clean);
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "چند خانه ایراد دارد؛ کنار هر کدام نوشته شده.", errors };
  }

  const supabase = await createClient();
  const problems: string[] = [];

  // ---------------------------------------------------------- site_info
  const filled = EDITABLE_KEYS.filter((key) => clean.siteInfo[key]).map((key) => ({
    key,
    value: clean.siteInfo[key],
  }));
  if (filled.length > 0) {
    const { error } = await supabase.from("site_info").upsert(filled, { onConflict: "key" });
    if (error) problems.push("اطلاعات تابلو و کارت ویزیت ذخیره نشد.");
  }

  // «کلید خالی» یعنی ردیفش نباشد، نه رشتهٔ خالی (H-6)
  const emptied = EDITABLE_KEYS.filter((key) => !clean.siteInfo[key]);
  if (emptied.length > 0) {
    const { data: existing } = await supabase.from("site_info").select("key").in("key", emptied);
    const toDelete = (existing ?? []).map((row) => row.key);
    if (toDelete.length > 0) {
      const { data: deleted, error } = await supabase
        .from("site_info")
        .delete()
        .in("key", toDelete)
        .select("key");
      // بدون قاعدهٔ پاک کردن در پایگاه داده، RLS بی‌صدا هیچ ردیفی پاک نمی‌کند
      const gone = new Set((deleted ?? []).map((row) => row.key));
      const stuck = toDelete.filter((key) => !gone.has(key));
      if (error || stuck.length > 0) {
        const names = stuck.map((key) => `«${KEY_LABELS[key as keyof typeof KEY_LABELS] ?? key}»`);
        problems.push(
          `خالی کردن ${names.join("، ")} هنوز ممکن نیست، چون پایگاه داده اجازهٔ پاک کردن این اطلاعات را ندارد.`,
        );
      }
    }
  }

  // ---------------------------------------------------------- clinics
  for (const clinic of clean.clinics) {
    const { data, error } = await supabase
      .from("clinics")
      .update({ name: clinic.name, address: clinic.address, directions: clinic.directions || null })
      .eq("id", clinic.id)
      .select("id");
    if (error || !data?.length) problems.push(`اطلاعات «${clinic.name}» ذخیره نشد.`);
  }

  // ---------------------------------------------------------- faq_items
  // ترتیب سایت همان ترتیب فهرست است؛ حذف نداریم، خاموش کردن داریم
  const rows = clean.faqItems.map((item, index) => ({
    item,
    row: {
      question: item.question,
      answer: item.answer,
      keywords: item.keywords,
      sort_order: index + 1,
      is_active: item.isActive,
    },
  }));

  const existing = rows.filter(({ item }) => item.id);
  if (existing.length > 0) {
    const { error } = await supabase
      .from("faq_items")
      .upsert(existing.map(({ item, row }) => ({ id: item.id as string, ...row })), { onConflict: "id" });
    if (error) problems.push("تغییر پرسش‌ها ذخیره نشد.");
  }

  const savedIds = new Map<string, string>();
  const fresh = rows.filter(({ item }) => !item.id);
  if (fresh.length > 0) {
    const { data, error } = await supabase
      .from("faq_items")
      .insert(fresh.map(({ row }) => row))
      .select("id, question");
    if (error) problems.push("پرسش‌های تازه ذخیره نشدند.");
    for (const row of data ?? []) {
      const match = fresh.find(({ item }) => item.question === row.question);
      if (match) savedIds.set(match.item.key, row.id);
    }
  }

  // سایت همان لحظه تازه شود، حتی اگر بخشی ذخیره نشده: هر چه نوشته شده باید دیده شود
  updateTag(PUBLIC_INFO_TAG);

  if (problems.length > 0) {
    return { ok: false, message: problems.join(" "), errors: {} };
  }

  const saved: SettingsDraft = {
    ...clean,
    faqItems: clean.faqItems.map((item) => {
      const id = item.id ?? savedIds.get(item.key) ?? null;
      return id ? { ...item, id, key: id } : item;
    }),
  };
  return { ok: true, message: "ذخیره شد. سایت هم تازه شد.", saved };
}
