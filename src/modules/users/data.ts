import 'server-only';

import { randomBytes } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/lib/panel-routes';
import type { PanelAccount } from './types';

export type { PanelAccount };

/**
 * خواندن و نوشتن حساب‌های پنل — کار `p1-12`.
 *
 * ⚠️ این فایل با `createAdminClient()` کار می‌کند، چون ساختن حساب در
 * `auth.users` از هیچ مسیر دیگری ممکن نیست. آن کلاینت **از همهٔ قاعده‌های
 * RLS رد می‌شود**، پس هر تابع اینجا باید خودش فرض کند هیچ نگهبانی بالادست
 * ندارد.
 *
 * نگهبان‌ها:
 *   — نقش فراخواننده: در `src/app/panel/users/actions.ts` با `requireRole`
 *   — آخرین پزشک فعال (`U-04`): در **خود پایگاه داده**، trigger
 *     `profiles_last_doctor_guard` در migration ۰۰۱۲. اینجا دوباره بررسی
 *     نمی‌شود چون دو نسخه از یک قاعده روزی از هم جدا می‌شوند.
 *
 * خط اول `import 'server-only'` است (بند ۳ بخش ۷ `CLAUDE.md`).
 */

/** همهٔ حساب‌های پنل، تازه‌ترین پایین. */
export async function listPanelAccounts(): Promise<PanelAccount[]> {
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('user_id, full_name, role, is_active, must_change_password, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('خواندن فهرست کاربران ناموفق بود.');
  }

  // نشانی ایمیل در `auth.users` است، نه در `profiles`.
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (authError) {
    throw new Error('خواندن نشانی‌های ایمیل ناموفق بود.');
  }
  const emailById = new Map(authUsers.users.map((u) => [u.id, u.email ?? '']));

  return profiles.map((p) => ({
    userId: p.user_id,
    email: emailById.get(p.user_id) ?? '—',
    fullName: p.full_name,
    role: p.role as AppRole,
    isActive: p.is_active,
    mustChangePassword: p.must_change_password,
    createdAt: p.created_at,
  }));
}

/** رمز موقت: ۲۴ نویسهٔ تصادفی. یک‌بار به پزشک نشان داده می‌شود و ذخیره نمی‌شود. */
function generateTemporaryPassword(): string {
  return randomBytes(18).toString('base64url');
}

export type CreateAccountResult =
  | { ok: true; temporaryPassword: string }
  | { ok: false; error: string };

/**
 * ساخت حساب منشی. `U-05`: ثبت‌نام عمومی بسته است و حساب فقط از اینجا ساخته می‌شود.
 *
 * نقش در `app_metadata` می‌نشیند، نه `user_metadata` — طبق `U-03`، چون
 * کاربر خودش می‌تواند `user_metadata` را عوض کند.
 */
export async function createSecretaryAccount(input: {
  email: string;
  fullName: string;
}): Promise<CreateAccountResult> {
  const admin = createAdminClient();
  const temporaryPassword = generateTemporaryPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: 'secretary' },
  });

  if (error || !data.user) {
    // پیام خام Supabase انگلیسی است و به کاربر نشان داده نمی‌شود.
    const alreadyExists = error?.message?.toLowerCase().includes('already');
    return {
      ok: false,
      error: alreadyExists
        ? 'حسابی با این نشانی ایمیل از قبل هست.'
        : 'ساخت حساب ناموفق بود.',
    };
  }

  const { error: profileError } = await admin.from('profiles').insert({
    user_id: data.user.id,
    full_name: input.fullName,
    role: 'secretary',
    is_active: true,
    must_change_password: true,
  });

  if (profileError) {
    // اگر رکورد پروفایل ساخته نشود، حساب auth نیمه‌کاره می‌ماند و کاربر
    // می‌تواند وارد شود ولی `getPanelUser` او را رد می‌کند. پس پاکش می‌کنیم.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: 'ساخت حساب ناقص ماند و برگردانده شد.' };
  }

  return { ok: true, temporaryPassword };
}

export type SetActiveResult = { ok: true } | { ok: false; error: string };

/**
 * فعال یا غیرفعال کردن یک حساب.
 *
 * `U-04` اینجا بررسی **نمی‌شود** — نگهبانش trigger پایگاه داده است. اگر
 * trigger جلویش را بگیرد، پیام فارسی خودش را برمی‌گرداند و همان به کاربر
 * نشان داده می‌شود.
 */
export async function setAccountActive(
  userId: string,
  isActive: boolean,
): Promise<SetActiveResult> {
  const { error } = await createAdminClient()
    .from('profiles')
    .update({ is_active: isActive })
    .eq('user_id', userId);

  if (error) {
    // پیام trigger فارسی است و مستقیم نشان داده می‌شود؛ بقیهٔ خطاها نه.
    const isGuard = error.message.includes('آخرین حساب فعال پزشک');
    return {
      ok: false,
      error: isGuard ? error.message : 'تغییر وضعیت حساب ناموفق بود.',
    };
  }

  return { ok: true };
}
