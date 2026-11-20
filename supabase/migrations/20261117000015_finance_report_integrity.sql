-- Align the report with the reviewed finance UI and enforce decision 0010.
-- No payment rows are updated or removed. Existing function grants are preserved.
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
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '22023', message = 'بازهٔ تاریخ گزارش معتبر نیست.';
  end if;

  with rows_in_range as (
    select p.*, (p.paid_at at time zone 'Asia/Tehran')::date as tehran_day,
      (p.amount_toman > 0 and p.reverses_payment_id is null
       and not exists (select 1 from public.payments r where r.reverses_payment_id = p.id)) as counted
    from public.payments p
    where p.paid_at >= (p_from::timestamp at time zone 'Asia/Tehran')
      and p.paid_at < ((p_to + 1)::timestamp at time zone 'Asia/Tehran')
  ), totals as (
    select coalesce(sum(amount_toman), 0) as net_total,
      count(*) filter (where counted) as payment_count
    from rows_in_range
  ), methods as (
    select payment_method_id as id, sum(amount_toman) as total,
      count(*) filter (where counted) as payment_count
    from rows_in_range group by payment_method_id
  ), insurances as (
    select insurance_type_id as id, sum(amount_toman) as total,
      count(*) filter (where counted) as payment_count
    from rows_in_range group by insurance_type_id
  ), days as (
    select tehran_day, sum(amount_toman) as total,
      count(*) filter (where counted) as payment_count
    from rows_in_range group by tehran_day
  )
  select jsonb_build_object(
    'net_total', t.net_total,
    'count', t.payment_count,
    -- Match Math.round in the UI, including negative half values after refunds.
    'average', case when t.payment_count = 0 then 0
      else floor(t.net_total / t.payment_count + 0.5) end,
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', m.name,
        'total', x.total, 'count', x.payment_count) order by x.total desc, m.name, x.id)
      from methods x join public.payment_methods m on m.id=x.id
      where x.payment_count > 0 or x.total <> 0), '[]'::jsonb),
    'by_insurance', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', coalesce(i.name,'بدون بیمه'),
        'total', x.total, 'count', x.payment_count) order by x.total desc, coalesce(i.name,'بدون بیمه'), x.id)
      from insurances x left join public.insurance_types i on i.id=x.id
      where x.payment_count > 0 or x.total <> 0), '[]'::jsonb),
    'daily', (select jsonb_agg(jsonb_build_object('day', p_from + g.n,
      'total', coalesce(d.total,0), 'count', coalesce(d.payment_count,0)) order by g.n)
      from generate_series(0, p_to - p_from) g(n)
      left join days d on d.tehran_day=p_from+g.n)
  ) into result from totals t;
  return result;
end;
$$;

create or replace function public.check_payment_reversal()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  orig public.payments%rowtype;
begin
  if new.reverses_payment_id is null then
    return new;
  end if;

  select * into orig from public.payments where id = new.reverses_payment_id;
  if not found then
    raise exception 'پرداختی که می‌خواهید معکوس کنید پیدا نشد.';
  end if;

  -- Decision 0010: enforce the secretary's Tehran-day limit even via direct INSERT.
  -- This SECURITY DEFINER function can see originals hidden by the SELECT policy.
  if public.current_app_role() = 'secretary'
     and (orig.paid_at at time zone 'Asia/Tehran')::date <> public.tehran_today() then
    raise exception using errcode = '42501',
      message = 'پرداخت‌های روزهای قبل یا آینده را فقط پزشک می‌تواند معکوس کند.';
  end if;

  -- زنجیره ممنوع: معکوسِ یک معکوس
  if orig.reverses_payment_id is not null then
    raise exception 'این ردیف خودش یک ثبت معکوس است و دوباره معکوس نمی‌شود.';
  end if;

  -- H-2: مبلغ باید قرینهٔ دقیق باشد، نه فقط علامت مخالف.
  -- بدون این، معکوسِ ۴۰۰٬۰۰۰− برای پرداخت ۵۰۰٬۰۰۰ تومانی، ۱۰۰ هزار تومان
  -- درآمد جعلی برای همیشه در گزارش جا می‌گذاشت.
  if new.amount_toman <> -orig.amount_toman then
    raise exception 'مبلغ ثبت معکوس باید دقیقاً قرینهٔ مبلغ اصلی باشد.';
  end if;

  -- H-2: همان روش پرداخت و همان مراجع و همان بیمه.
  -- وگرنه معکوسِ یک پرداخت کارتخوان با «نقدی» ثبت می‌شد و جمع کل درست
  -- می‌ماند ولی تفکیک روش پرداخت غلط می‌شد.
  if new.payment_method_id is distinct from orig.payment_method_id then
    raise exception 'روش پرداخت ثبت معکوس باید همان روش پرداخت اصلی باشد.';
  end if;
  if new.patient_id is distinct from orig.patient_id then
    raise exception 'ثبت معکوس باید برای همان مراجع ردیف اصلی باشد.';
  end if;
  if new.insurance_type_id is distinct from orig.insurance_type_id then
    raise exception 'نوع بیمهٔ ثبت معکوس باید همان نوع بیمهٔ ردیف اصلی باشد.';
  end if;

  -- H-3: paid_at همان تاریخ پرداخت اصلی است.
  -- اصلاح اشتباه باید در همان ماهی بنشیند که پول گرفته شده؛ وگرنه هم ماه
  -- قبل و هم ماه جاری غلط می‌شدند. برگشت پول واقعی راه جدا دارد:
  -- پرداخت منفی با reverses_payment_id خالی.
  if new.paid_at is distinct from orig.paid_at then
    raise exception 'تاریخ ثبت معکوس باید همان تاریخ پرداخت اصلی باشد.';
  end if;

  return new;
end;
$$;
