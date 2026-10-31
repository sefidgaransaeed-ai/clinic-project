-- ============================================================================
-- توابع — پیاده‌سازی بخش ۸ سند مدل داده
--
-- توابعی که anon صدا می‌زند security definer هستند: با دسترسی سازنده اجرا
-- می‌شوند، نه فراخواننده. این تنها راهی است که کاربر ناشناس کاری بکند بدون
-- اینکه به هیچ جدولی دسترسی مستقیم داشته باشد (قاعدهٔ بخش ۱ سند).
--
-- search_path روی هر کدام ثابت شده تا کسی نتواند با تعریف schema هم‌نام،
-- رفتار تابع را عوض کند.
-- ============================================================================

-- ------------------------------------------------------- نقش و منطقه زمانی
create or replace function public.current_app_role()
returns text
language sql stable
security definer set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.is_doctor() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select public.current_app_role() = 'doctor'; $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select public.current_app_role() in ('doctor', 'secretary'); $$;

-- «امروز» و «روز هفته» همیشه به وقت مطب حساب می‌شوند، نه UTC (H-12).
create or replace function public.tehran_today() returns date
language sql stable
as $$ select (now() at time zone 'Asia/Tehran')::date; $$;

-- Q-1: شنبه = ۰ تا جمعه = ۶.
-- EXTRACT(DOW) پستگرس یکشنبه را ۰ می‌گیرد، پس باید جابه‌جا شود.
create or replace function public.clinic_weekday(d date) returns smallint
language sql immutable
as $$ select ((extract(dow from d)::int + 1) % 7)::smallint; $$;

create or replace function public.setting_int(k text, fallback int) returns int
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select value::int from public.app_settings where key = k), fallback); $$;

-- ============================================================ کاربر ناشناس

-- فقط بازه‌های آزاد برمی‌گردد. هیچ اطلاعاتی از نوبت‌های موجود فاش نمی‌شود.
create or replace function public.available_slots(day date)
returns table (starts_at timestamptz, ends_at timestamptz)
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
           g.s + make_interval(mins => slot_min) as e
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
  select grid.s, grid.e
  from grid
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

-- M-2: پارامتر for_self می‌گوید شمارهٔ واردشده مال خود مراجع است یا همراهش
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
    starts_at, ends_at, status, source
  ) values (
    trim(p_name), p_mobile, p_national_id, p_for_self,
    p_starts_at, v_ends_at, 'requested', 'site'
  ) returning id into v_id;

  return v_id;
end;
$$;

-- همه چیزی که سایت عمومی لازم دارد، در یک فراخوانی
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
    'working_hours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'weekday', w.weekday, 'start_time', w.start_time, 'end_time', w.end_time)
             order by w.weekday)
      from public.working_hours w where w.is_active), '[]'::jsonb),
    'closures', coalesce((
      select jsonb_agg(c.closure_date order by c.closure_date)
      from public.closures c where c.closure_date >= public.tehran_today()), '[]'::jsonb)
  );
$$;

-- H-9: فقط تاریخ و ساعت نوبت. نام و موبایل و کد ملی برنمی‌گردند،
-- چون لینک ممکن است دست کس دیگری بیفتد.
create or replace function public.get_survey(p_token text)
returns table (starts_at timestamptz)
language plpgsql stable
security definer set search_path = public, pg_temp
as $$
declare
  valid_days int := public.setting_int('survey_valid_days', 30);
begin
  return query
  select a.starts_at
  from public.surveys s
  join public.appointments a on a.id = s.appointment_id
  where s.token = p_token
    and s.submitted_at is null
    and s.created_at > now() - make_interval(days => valid_days);

  if not found then
    raise exception 'این لینک معتبر نیست یا قبلاً پاسخ داده شده است.';
  end if;
end;
$$;

create or replace function public.submit_survey(
  p_token text, p_score smallint, p_comment text
) returns boolean
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  valid_days int := public.setting_int('survey_valid_days', 30);
  v_rows int;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'امتیاز باید بین ۱ تا ۵ باشد.';
  end if;
  if char_length(coalesce(p_comment, '')) > 1000 then
    raise exception 'متن نظر نباید از ۱۰۰۰ حرف بیشتر باشد.';
  end if;

  update public.surveys s
     set score = p_score, comment = nullif(trim(coalesce(p_comment, '')), ''), submitted_at = now()
   where s.token = p_token
     and s.submitted_at is null
     and s.created_at > now() - make_interval(days => valid_days);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'این لینک معتبر نیست یا قبلاً پاسخ داده شده است.';
  end if;
  return true;
end;
$$;

-- H-8: مسیری که بخش ۷ سند ادعایش را داشت ولی بخش ۸ تعریفش نکرده بود
create or replace function public.log_unanswered_question(
  p_question text, p_channel text
) returns boolean
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  if char_length(coalesce(trim(p_question), '')) = 0 then
    raise exception 'پرسش خالی است.';
  end if;
  if char_length(p_question) > 300 then
    raise exception 'پرسش نباید از ۳۰۰ حرف بیشتر باشد.';
  end if;
  if p_channel not in ('site', 'telegram', 'bale') then
    raise exception 'کانال نامعتبر است.';
  end if;

  insert into public.chatbot_unanswered (question, channel)
  values (trim(p_question), p_channel);
  return true;
end;
$$;

-- ======================================================= پزشک و منشی

-- H-10: منشی به جدول surveys دسترسی ندارد، پس صفحهٔ p3-09 بدون این تابع
-- برای او قابل ساخت نیست. امتیاز و متن نظر برنمی‌گردند.
create or replace function public.done_appointments_without_survey(p_days int default 7)
returns table (appointment_id uuid, starts_at timestamptz, patient_name text)
language sql stable
security definer set search_path = public, pg_temp
as $$
  select a.id, a.starts_at, coalesce(p.full_name, a.requester_name)
  from public.appointments a
  left join public.patients p on p.id = a.patient_id
  where public.is_staff()
    and a.status = 'done'
    and a.ends_at > now() - make_interval(days => p_days)
    and not exists (select 1 from public.surveys s where s.appointment_id = a.id)
  order by a.starts_at desc;
$$;

create or replace function public.create_survey_link(p_appointment_id uuid)
returns text
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if not public.is_staff() then
    raise exception 'دسترسی ندارید.';
  end if;
  if not exists (
    select 1 from public.appointments a where a.id = p_appointment_id and a.status = 'done'
  ) then
    raise exception 'فقط برای نوبتی که انجام شده می‌توان لینک ساخت.';
  end if;

  select s.token into v_token from public.surveys s where s.appointment_id = p_appointment_id;
  if v_token is not null then
    return v_token;
  end if;

  v_token := encode(gen_random_bytes(16), 'hex');
  insert into public.surveys (appointment_id, token) values (p_appointment_id, v_token);
  return v_token;
end;
$$;

-- H-11 و H-12: شش خروجی، و مرز روزها به وقت Asia/Tehran.
-- بدون تبدیل منطقهٔ زمانی، پرداخت ساعت ۰۰:۳۰ بامداد تهران در UTC ساعت
-- ۲۱:۰۰ روز قبل است و در گزارش ماه اشتباه می‌افتاد.
create or replace function public.finance_report(p_from date, p_to date)
returns jsonb
language plpgsql stable
security definer set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_doctor() then
    raise exception 'گزارش مالی فقط برای پزشک است.';
  end if;

  with rows_in_range as (
    select p.*, (p.paid_at at time zone 'Asia/Tehran')::date as tehran_day
    from public.payments p
    where (p.paid_at at time zone 'Asia/Tehran')::date between p_from and p_to
  )
  select jsonb_build_object(
    'net_total',  coalesce((select sum(amount_toman) from rows_in_range), 0),
    'count',      (select count(*) from rows_in_range),
    'average',    coalesce((select round(avg(amount_toman)) from rows_in_range), 0),
    'by_method',  coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'total', t.total) order by m.name)
      from (select payment_method_id, sum(amount_toman) total
            from rows_in_range group by payment_method_id) t
      join public.payment_methods m on m.id = t.payment_method_id), '[]'::jsonb),
    'by_insurance', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(i.name, 'بدون بیمه'), 'total', t.total)
                       order by coalesce(i.name, 'بدون بیمه'))
      from (select insurance_type_id, sum(amount_toman) total
            from rows_in_range group by insurance_type_id) t
      left join public.insurance_types i on i.id = t.insurance_type_id), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.tehran_day, 'total', d.total) order by d.tehran_day)
      from (select tehran_day, sum(amount_toman) total
            from rows_in_range group by tehran_day) d), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- A-5: مجری تصمیم N-03. یک cron روزانه این را صدا می‌زند.
create or replace function public.expire_stale_requests()
returns integer
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_rows int;
begin
  update public.appointments a
     set status = 'cancelled', cancel_reason = 'expired'
   where a.status = 'requested'
     and a.starts_at < now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
