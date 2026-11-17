-- Schedule settings integrity; see decision 0013 (review required before deployment).
-- These constrain configuration, not appointments: A-2/A-6 panel exceptions remain valid.
-- Existing invalid rows make deployment fail; no data is silently changed.
set local lock_timeout = '5s';

alter table public.working_hours alter column clinic_id set not null;

-- Adjacent ranges are allowed. Inactive rows keep history without blocking new hours.
alter table public.working_hours
  add constraint working_hours_no_active_overlap
  exclude using gist (
    weekday with =,
    numrange(extract(epoch from start_time), extract(epoch from end_time), '[)') with &&
  ) where (is_active);

-- Different non-overlapping shifts must still belong to one active clinic per weekday.
-- btree_gist is already installed by migration 0001 and supports uuid <>.
alter table public.working_hours
  add constraint working_hours_one_active_clinic_per_day
  exclude using gist (weekday with =, clinic_id with <>) where (is_active);

alter table public.closures add column is_active boolean not null default true;
comment on column public.closures.is_active is
  'لغو تعطیلی با حفظ ردیف: false یعنی این تعطیلی دیگر روز را نمی‌بندد. فقط پزشک طبق RLS آن را تغییر می‌دهد.';

-- Keep the unique closure_date and existing INSERT/UPDATE policies; no DELETE grant.
-- Reopening a previously cancelled closure updates the same row instead of inserting another.
-- CREATE OR REPLACE preserves signatures and existing grants for all three RPCs.

create or replace function public.available_slots(day date)
returns table (
  starts_at     timestamptz,
  ends_at       timestamptz,
  clinic_id     uuid,
  clinic_name   text,
  clinic_address text
)
language plpgsql stable
security definer set search_path = public, pg_temp
as $$
declare
  slot_min int := public.setting_int('slot_minutes', 15);
begin
  if exists (select 1 from public.closures c where c.closure_date = day and c.is_active) then
    return;
  end if;

  return query
  with grid as (
    select g.s as s,
           g.s + make_interval(mins => slot_min) as e,
           w.clinic_id as cid
    from public.working_hours w
    cross join lateral generate_series(
      -- ساعت کاری بدون منطقه ذخیره می‌شود؛ اینجا به وقت تهران تفسیرش می‌کنیم
      ((day + w.start_time) at time zone 'Asia/Tehran'),
      ((day + w.end_time)   at time zone 'Asia/Tehran') - make_interval(mins => slot_min),
      make_interval(mins => slot_min)
    ) as g(s)
    where w.is_active
      and w.weekday = public.clinic_weekday(day)
  )
  select grid.s, grid.e, grid.cid, c.name, c.address
  from grid
  left join public.clinics c on c.id = grid.cid
  -- کم‌کردن با هم‌پوشانی بازه، نه برابری starts_at:
  -- نوبت ۴۵ دقیقه‌ای سه خانهٔ ۱۵ دقیقه‌ای را می‌گیرد
  where not exists (
    select 1 from public.appointments a
    where a.status in ('confirmed', 'arrived', 'done')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(grid.s, grid.e, '[)')
  )
    and grid.s > now()
  order by grid.s;
end;
$$;

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

  if exists (select 1 from public.closures c where c.closure_date = v_day and c.is_active) then
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

create or replace function public.get_public_info()
returns jsonb
language sql stable
security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer)
                       order by f.sort_order, f.created_at)
      from public.faq_items f where f.is_active), '[]'::jsonb),
    -- کلیدی که ردیف ندارد اصلاً برنمی‌گردد (قاعدهٔ H-6)
    'site_info', coalesce((
      select jsonb_object_agg(s.key, s.value) from public.site_info s), '{}'::jsonb),
    -- تصمیم 0011: سایت نشانی هر دو مطب را از اینجا می‌گیرد، نه از site_info
    'clinics', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name,
               'address', c.address, 'directions', c.directions)
             order by c.sort_order, c.name)
      from public.clinics c where c.is_active), '[]'::jsonb),
    'working_hours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'weekday', w.weekday, 'start_time', w.start_time,
               'end_time', w.end_time, 'clinic_id', w.clinic_id)
             order by w.weekday)
      from public.working_hours w where w.is_active), '[]'::jsonb),
    'closures', coalesce((
      select jsonb_agg(c.closure_date order by c.closure_date)
      from public.closures c where c.is_active and c.closure_date >= public.tehran_today()), '[]'::jsonb)
  );
$$;
