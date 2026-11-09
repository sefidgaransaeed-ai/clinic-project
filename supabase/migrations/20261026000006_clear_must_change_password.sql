-- ============================================================================
-- تابع پایین‌آوردن پرچم «رمز موقت را عوض کن»
--
-- چرا لازم شد: هنگام ساخت صفحهٔ تغییر رمز در کار p1-10 معلوم شد جدول
-- profiles هیچ policy ویرایشی برای منشی ندارد — فقط `profiles_doctor_update`
-- هست. پس وقتی منشی رمزش را عوض می‌کرد، دستور
--
--     update profiles set must_change_password = false where user_id = …
--
-- بی‌صدا **صفر ردیف** را عوض می‌کرد: RLS ردیف را فیلتر می‌کند و خطا هم
-- نمی‌دهد. نتیجه این می‌شد که منشی هر بار که وارد می‌شود دوباره به صفحهٔ
-- تغییر رمز بیفتد، بی‌آنکه کسی بفهمد چرا.
--
-- چرا policy ساده جوابش نیست: اگر `profiles_self_update` می‌نوشتیم که
-- «هر کس ردیف خودش را ویرایش کند»، منشی می‌توانست ستون role خودش را
-- 'doctor' کند یا is_active را دست بزند. یعنی برای درست کردن یک دردسر
-- کوچک، یک راه ارتقای دسترسی باز می‌کردیم.
--
-- پس یک تابع `security definer` که **فقط همان یک ستون** و **فقط برای
-- ردیف خودِ کاربر** را عوض می‌کند. نه ستون دیگری، نه ردیف دیگری.
-- ============================================================================

create or replace function public.clear_must_change_password()
returns void
language sql
security definer set search_path = public, pg_temp
as $$
  update public.profiles
     set must_change_password = false
   where user_id = auth.uid();
$$;

comment on function public.clear_must_change_password() is
  'پرچم رمز موقت را فقط برای ردیف خودِ کاربر پایین می‌آورد. جای policy ویرایش profiles برای منشی را می‌گیرد، بدون اینکه ستون role قابل تغییر شود.';

-- بسته به پیش‌فرض، باز برای کاربر واردشده. anon کاری با آن ندارد:
-- `auth.uid()` برای anon خالی است و هیچ ردیفی را نمی‌گیرد، ولی باز گذاشتنش
-- هم دلیلی ندارد.
revoke execute on function public.clear_must_change_password() from public, anon;
grant  execute on function public.clear_must_change_password() to authenticated;
