-- ============================================================================
-- توابعی که باید مطب را بشناسند — تصمیم 0011
--
-- سه تابع عوض می‌شوند:
--   available_slots       — نام و نشانی مطب را کنار هر بازه برمی‌گرداند
--   request_appointment   — مطب را از روی روز پر می‌کند
--   get_public_info       — فهرست مطب‌ها را به سایت می‌دهد
--
-- ⚠️ `available_slots` نوع خروجی‌اش عوض می‌شود، و پستگرس اجازهٔ
-- `create or replace` روی تابعی که ستون‌های خروجی‌اش فرق کرده نمی‌دهد.
-- پس اول `drop` و بعد ساخت دوباره — و چون `drop` اجازه‌ها را هم می‌برد،
-- `grant` دوباره داده می‌شود.
-- ============================================================================

drop function if exists public.available_slots(date);

create function public.available_slots(day date)
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
  if exists (select 1 from public.closures c where c.closure_date = day) then
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

-- ------------------------------------------------- مطبِ یک لحظهٔ مشخص
-- یک جا برای این منطق، تا `request_appointment` و ثبت دستی پنل و هر مسیر
-- آینده همگی یک جواب بدهند.
create or replace function public.clinic_for_moment(p_at timestamptz)
returns uuid
language sql stable
security definer set search_path = public, pg_temp
as $$
  select w.clinic_id
  from public.working_hours w
  where w.is_active
    and w.weekday = public.clinic_weekday((p_at at time zone 'Asia/Tehran')::date)
    and (p_at at time zone 'Asia/Tehran')::time >= w.start_time
    and (p_at at time zone 'Asia/Tehran')::time <  w.end_time
  limit 1;
$$;

comment on function public.clinic_for_moment(timestamptz) is
  'مطبِ یک لحظه را از روی برنامهٔ هفتگی برمی‌گرداند. اگر بیرون ساعت کاری باشد null — همان حالتی که منشی استثنا زده (A-6).';

-- --------------------------------------------- اطلاعات عمومی سایت
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
      from public.closures c where c.closure_date >= public.tehran_today()), '[]'::jsonb)
  );
$$;

-- ============================================================ اجازهٔ اجرا
-- `drop` اجازه‌های `available_slots` را برد؛ دوباره داده می‌شود.
-- `clinic_for_moment` تازه است و طبق قاعدهٔ فایل 0005 پیش‌فرض بسته است.
grant execute on function public.available_slots(date)            to anon, authenticated;
grant execute on function public.clinic_for_moment(timestamptz)   to authenticated;
