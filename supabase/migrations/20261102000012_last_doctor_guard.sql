-- ============================================================================
-- نگهبان آخرین پزشک فعال — معیار پذیرش U-04
--
-- چرا در پایگاه داده و نه فقط در کد: صفحهٔ مدیریت کاربران با
-- `createAdminClient()` کار می‌کند و آن کلاینت از همهٔ قاعده‌های RLS رد
-- می‌شود. پس اگر این قاعده فقط در TypeScript بود، تنها نگهبانش همان چند
-- خط کد می‌شد و هر مسیر دیگری — یک اسکریپت، SQL Editor، یا کار بعدی که
-- کسی می‌نویسد — می‌توانست دورش بزند.
--
-- همان استدلال تصمیم `A-3` و trigger قفل ۷ روز: قاعده‌ای که مسیرهای
-- service_role هم باید رعایتش کنند، باید در خود پایگاه داده باشد.
-- ============================================================================

create or replace function public.guard_last_active_doctor()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_other_doctors int;
begin
  -- فقط وقتی معنا دارد که ردیف از «پزشکِ فعال» بودن بیرون می‌رود؛
  -- چه با غیرفعال‌شدن، چه با عوض‌شدن نقش.
  if not (old.role = 'doctor' and old.is_active) then
    return new;
  end if;
  if new.role = 'doctor' and new.is_active then
    return new;
  end if;

  select count(*) into v_other_doctors
  from public.profiles p
  where p.role = 'doctor'
    and p.is_active
    and p.user_id <> old.user_id;

  if v_other_doctors = 0 then
    raise exception 'آخرین حساب فعال پزشک را نمی‌توان غیرفعال کرد. اول یک حساب پزشک دیگر بسازید.';
  end if;

  return new;
end;
$$;

create trigger profiles_last_doctor_guard
  before update on public.profiles
  for each row execute function public.guard_last_active_doctor();

-- حذف هم باید بسته بماند. هیچ policy حذفی روی profiles نیست، ولی
-- service_role از policy رد می‌شود؛ پس همان نگهبان برای delete هم لازم است.
create or replace function public.guard_last_active_doctor_delete()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_other_doctors int;
begin
  if not (old.role = 'doctor' and old.is_active) then
    return old;
  end if;

  select count(*) into v_other_doctors
  from public.profiles p
  where p.role = 'doctor'
    and p.is_active
    and p.user_id <> old.user_id;

  if v_other_doctors = 0 then
    raise exception 'آخرین حساب فعال پزشک را نمی‌توان حذف کرد.';
  end if;

  return old;
end;
$$;

create trigger profiles_last_doctor_guard_delete
  before delete on public.profiles
  for each row execute function public.guard_last_active_doctor_delete();

-- طبق فایل 0005، اجازهٔ اجرای توابع تازه پیش‌فرض بسته است. این دو تابع
-- trigger هستند و از بیرون صدا زده نمی‌شوند، پس grant لازم ندارند.
revoke execute on function public.guard_last_active_doctor()        from public, anon, authenticated;
revoke execute on function public.guard_last_active_doctor_delete() from public, anon, authenticated;

comment on function public.guard_last_active_doctor is
  'U-04 — آخرین حساب فعال پزشک نه غیرفعال می‌شود و نه نقشش عوض.';
