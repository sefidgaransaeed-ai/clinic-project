'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth';
import { createSecretaryAccount, setAccountActive } from '@/modules/users/data';

/**
 * هر دو action خط اولشان `requireRole(['doctor'])` است.
 *
 * ⚠️ **Server Action یک مسیر HTTP مستقل است.** قفل `src/proxy.ts` فقط
 * ناوبری صفحه‌ها را می‌گیرد؛ اگر این خط نباشد، منشی می‌تواند همین action
 * را مستقیم صدا بزند و حساب بسازد. این همان چیزی است که بند ۵ بخش ۷
 * `CLAUDE.md` از آن حرف می‌زند.
 */

export type CreateUserState = {
  error: string | null;
  createdEmail: string | null;
  temporaryPassword: string | null;
};

export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireRole(['doctor']);

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'نشانی ایمیل درست نیست.', createdEmail: null, temporaryPassword: null };
  }
  if (fullName.length < 3) {
    return { error: 'نام و نام خانوادگی را کامل بنویسید.', createdEmail: null, temporaryPassword: null };
  }

  const result = await createSecretaryAccount({ email, fullName });
  if (!result.ok) {
    return { error: result.error, createdEmail: null, temporaryPassword: null };
  }

  revalidatePath('/panel/users');
  return { error: null, createdEmail: email, temporaryPassword: result.temporaryPassword };
}

export type ToggleActiveState = { error: string | null };

export async function toggleActive(
  _prev: ToggleActiveState,
  formData: FormData,
): Promise<ToggleActiveState> {
  await requireRole(['doctor']);

  const userId = String(formData.get('userId') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';

  if (!userId) {
    return { error: 'حساب مشخص نشد.' };
  }

  const result = await setAccountActive(userId, next);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath('/panel/users');
  return { error: null };
}
