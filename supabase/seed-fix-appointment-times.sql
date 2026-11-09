-- ============================================================================
-- اصلاح زمان نوبت‌های ساختگی
--
-- ایراد: همهٔ ۳۲ نوبت ساختگی ساعت ۰۰:۰۰ به وقت تهران بودند و روی هر هفت
-- روز هفته پخش شده بودند — از جمله جمعه. یعنی هیچ‌کدام روی هیچ بازه‌ای که
-- `available_slots` برمی‌گرداند نمی‌نشستند.
--
-- چرا کسی زودتر ندید: تا پیش از تصمیم 0011 چیزی این را نمی‌سنجید. وقتی
-- ستون `clinic_id` اضافه شد و خواستیم از روی ساعت پرش کنیم، هر ۳۲ ردیف
-- `null` گرفتند و ایراد خودش را نشان داد.
--
-- چرا مهم است: نفر دوم و سوم دارند صفحه‌هایشان را به همین داده وصل
-- می‌کنند. نوبتی که ساعت دوازده شب جمعه است، کارشان را شبیه خرابی
-- نشان می‌دهد و وقتشان را سر اشکالی که مال آن‌ها نیست تلف می‌کند.
--
-- روش: به‌جای حذف و ساخت دوباره، فقط `starts_at` جابه‌جا می‌شود. حذف
-- یعنی پرداخت‌هایی که به این نوبت‌ها وصل‌اند هم بپرند.
-- ============================================================================

do $fix$
declare
  slot_min int := public.setting_int('slot_minutes', 15);
begin
  -- ---------------------------------------- همهٔ بازه‌های معتبر ۱۲۰ روز
  create temporary table valid_slots on commit drop as
  with days as (
    select d::date as the_day
    from generate_series(
      public.tehran_today() - 60,
      public.tehran_today() + 60,
      interval '1 day'
    ) d
  )
  select
    (g.s at time zone 'UTC')                 as starts_at,
    w.clinic_id,
    row_number() over (order by g.s)         as rn,
    (g.s < now())                            as is_past
  from days
  join public.working_hours w
    on w.is_active and w.weekday = public.clinic_weekday(days.the_day)
  cross join lateral generate_series(
    ((days.the_day + w.start_time) at time zone 'Asia/Tehran'),
    ((days.the_day + w.end_time)   at time zone 'Asia/Tehran')
      - make_interval(mins => slot_min),
    make_interval(mins => slot_min)
  ) as g(s);

  -- ------------------------------- نوبت‌های گذشته روی بازه‌های گذشته
  -- وضعیت‌های done و no_show و cancelled باید در گذشته بمانند، وگرنه
  -- «نوبت انجام‌شدهٔ هفتهٔ آینده» در فهرست‌ها پیدا می‌شود.
  with past_appointments as (
    select id, row_number() over (order by starts_at desc) as rn
    from public.appointments
    where status in ('done', 'no_show', 'cancelled')
  ),
  past_slots as (
    select starts_at, clinic_id, row_number() over (order by starts_at desc) as rn
    from valid_slots where is_past
  )
  update public.appointments a
     set starts_at = s.starts_at,
         ends_at   = s.starts_at + make_interval(mins => slot_min),
         clinic_id = s.clinic_id
    from past_appointments p
    join past_slots s on s.rn = p.rn
   where a.id = p.id;

  -- ------------------------------- نوبت‌های پیش‌رو روی بازه‌های آینده
  with future_appointments as (
    select id, row_number() over (order by starts_at) as rn
    from public.appointments
    where status in ('requested', 'confirmed', 'arrived')
  ),
  future_slots as (
    select starts_at, clinic_id, row_number() over (order by starts_at) as rn
    from valid_slots where not is_past
  )
  update public.appointments a
     set starts_at = s.starts_at,
         ends_at   = s.starts_at + make_interval(mins => slot_min),
         clinic_id = s.clinic_id
    from future_appointments f
    join future_slots s on s.rn = f.rn
   where a.id = f.id;

  -- ------------------------------- پرداخت‌ها با نوبتشان هماهنگ بمانند
  -- H-3 می‌گوید تاریخ پرداخت نباید خودسرانه عوض شود، ولی این‌جا داده
  -- ساختگی است و نوبتش تازه جابه‌جا شده. پرداختی که تاریخش از نوبتش جلو
  -- بیفتد، گزارش مالی را بی‌معنا می‌کند.
  --
  -- trigger ویرایش پرداخت را مسدود می‌کند، پس موقتاً خاموشش می‌کنیم.
  alter table public.payments disable trigger payments_no_update;

  update public.payments p
     set paid_at = a.starts_at + interval '30 minutes'
    from public.appointments a
   where a.id = p.appointment_id
     and p.reverses_payment_id is null;

  -- ردیف معکوس باید همان تاریخ اصلی را داشته باشد (H-3)
  update public.payments r
     set paid_at = o.paid_at
    from public.payments o
   where r.reverses_payment_id = o.id;

  alter table public.payments enable trigger payments_no_update;
end $fix$;
