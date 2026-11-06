'use client';

import { useActionState } from 'react';

import {
  createUser,
  toggleActive,
  type CreateUserState,
  type ToggleActiveState,
} from '@/app/panel/users/actions';
import type { PanelAccount } from './types';

const inputClass =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50';

const createInitial: CreateUserState = {
  error: null,
  createdEmail: null,
  temporaryPassword: null,
};

export function CreateSecretaryForm() {
  const [state, formAction, isPending] = useActionState(createUser, createInitial);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <label htmlFor="fullName" className="block text-sm font-medium">
          نام و نام خانوادگی
        </label>
        <input id="fullName" name="fullName" type="text" required minLength={3} className={inputClass} />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          نشانی ایمیل
        </label>
        <input id="email" name="email" type="email" dir="ltr" required className={inputClass} />
        <p className="text-xs opacity-60">با همین نشانی وارد پنل می‌شود.</p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      {state.temporaryPassword ? (
        <div className="space-y-2 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p>
            حساب <span dir="ltr">{state.createdEmail}</span> ساخته شد.
          </p>
          <p className="font-medium">رمز موقت:</p>
          <p dir="ltr" className="select-all rounded bg-black/5 px-2 py-1 font-mono text-xs dark:bg-white/10">
            {state.temporaryPassword}
          </p>
          <p className="text-xs">
            این رمز فقط همین یک‌بار نشان داده می‌شود و هیچ‌جا ذخیره نشده است. همین حالا
            برایش بفرستید. در اولین ورود، خودش باید عوضش کند.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? 'در حال ساخت…' : 'ساخت حساب منشی'}
      </button>
    </form>
  );
}

const toggleInitial: ToggleActiveState = { error: null };

export function AccountsTable({ accounts }: { accounts: readonly PanelAccount[] }) {
  const [state, formAction] = useActionState(toggleActive, toggleInitial);

  return (
    <div className="space-y-3">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-right text-sm">
          <thead className="border-b border-black/10 text-xs opacity-70 dark:border-white/15">
            <tr>
              <th className="py-2 font-medium">نام</th>
              <th className="py-2 font-medium">ایمیل</th>
              <th className="py-2 font-medium">نقش</th>
              <th className="py-2 font-medium">وضعیت</th>
              <th className="py-2 font-medium">‌</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.userId} className="border-b border-black/5 dark:border-white/10">
                <td className="py-3">{account.fullName}</td>
                <td className="py-3" dir="ltr">
                  {account.email}
                </td>
                <td className="py-3">{account.role === 'doctor' ? 'پزشک' : 'منشی'}</td>
                <td className="py-3">
                  {account.isActive ? (
                    <span className="text-emerald-700 dark:text-emerald-400">فعال</span>
                  ) : (
                    <span className="opacity-60">غیرفعال</span>
                  )}
                  {account.mustChangePassword ? (
                    <span className="mr-2 text-xs opacity-60">· رمز موقت</span>
                  ) : null}
                </td>
                <td className="py-3">
                  <form action={formAction}>
                    <input type="hidden" name="userId" value={account.userId} />
                    <input type="hidden" name="next" value={String(!account.isActive)} />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/15 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      {account.isActive ? 'غیرفعال کن' : 'فعال کن'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
