-- ------------------------------- request_appointment با مطب (تصمیم 0011)
-- فقط یک چیز عوض شده: ستون clinic_id هنگام درج پر می‌شود. بقیهٔ بدنه
-- دست‌نخورده از فایل 0002 است، چون create or replace کل تابع را
-- بازنویسی می‌کند و تکه‌ای نمی‌شود عوضش کرد.
create or replace function public.request_appointment(
  p_name        text,
  p_mobile      text,
  p_national_id text,
  p_starts_at   timestamptz,
  p_for_self    boolean
) returns uuid
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  slot_min   int := public.setting_int('slot_minutes', 15);
  day_limit  int := public.setting_int('site_request_daily_limit', 3);
  v_day      date := (p_starts_at at time zone 'Asia/Tehran')::date;
  v_ends_at  timestamptz := p_starts_at + make_interval(mins => slot_min);
  v_id       uuid;
begin
  if p_mobile !~ '^09\d{9}$' then
    raise exception 'شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.';
  end if;
  if p_national_id !~ '^\d{10}$' then
    raise exception 'کد ملی باید ۱۰ رقم باشد.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'نام را وارد کنید.';
  end if;
  if p_for_self is null then
    raise exception 'مشخص کنید نوبت برای خودتان است یا شخص دیگری.';
  end if;

  if exists (select 1 from public.closures c where c.closure_date = v_day) then
    raise exception 'این روز تعطیل است. لطفاً روز دیگری انتخاب کنید.';
  end if;

  if not exists (
    select 1 from public.working_hours w
    where w.is_active and w.weekday = public.clinic_weekday(v_day)
  ) then
    raise exception 'این روز از روزهای کاری مطب نیست.';
  end if;

  -- M-4: شمارش روی شمارهٔ درخواست‌کننده است، نه مراجع.
  -- مسیر پنل این محدودیت را ندارد؛ منشی هر تعداد ثبت می‌کند.
  if (
    select count(*) from public.appointments a
    where a.requester_mobile = p_mobile
      and a.source = 'site'
      and a.created_at > now() - interval '1 day'
  ) >= day_limit then
    raise exception 'از این شماره امروز بیش از حد مجاز درخواست ثبت شده است. فردا دوباره تلاش کنید یا با مطب تماس بگیرید.';
  end if;

  if not exists (select 1 from public.available_slots(v_day) s where s.starts_at = p_starts_at) then
    raise exception 'این زمان دیگر آزاد نیست. لطفاً زمان دیگری انتخاب کنید.';
  end if;

  insert into public.appointments (
    requester_name, requester_mobile, requester_national_id, requested_for_self,
    starts_at, ends_at, status, source, clinic_id
  ) values (
    trim(p_name), p_mobile, p_national_id, p_for_self,
    p_starts_at, v_ends_at, 'requested', 'site',
    -- تصمیم 0011: مطب انتخاب نمی‌شود، از روی روز مشتق می‌شود
    public.clinic_for_moment(p_starts_at)
  ) returning id into v_id;

  return v_id;
end;
$$;
