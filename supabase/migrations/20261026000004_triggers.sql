-- ============================================================================
-- Trigger‌ها — قاعده‌هایی که با check قابل نوشتن نیستند
--
-- چرا check کافی نیست: check فقط به ستون‌های همان ردیف نگاه می‌کند، پس
-- نمی‌تواند بفهمد ردیف معکوس با ردیف اصلی می‌خواند یا نه.
-- ============================================================================

-- ---------------------------------------------- Q-8 · H-2 · H-3: ردیف معکوس
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

create trigger payments_reversal_check
  before insert on public.payments
  for each row execute function public.check_payment_reversal();

-- --------------------------------------------- ویرایش پرداخت ممنوع است
-- RLS هم policy ویرایش ندارد؛ این لایهٔ دوم است، تا حتی با service_role
-- هم اشتباهی ویرایش نشود.
create or replace function public.block_payment_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ویرایش پرداخت مجاز نیست. برای اصلاح، یک ثبت معکوس بزنید.';
end;
$$;

create trigger payments_no_update
  before update on public.payments
  for each row execute function public.block_payment_update();

-- ------------------------------------------------- A-3: قفل ۷ روز
-- RLS این را برای کاربر واردشده اعمال می‌کند، ولی مسیرهای service_role و
-- توابع security definer از RLS رد می‌شوند. این trigger قاعده را مستقل از
-- مسیر نگه می‌دارد.
create or replace function public.check_appointment_edit_window()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status
     and old.ends_at < now() - make_interval(days => public.setting_int('past_edit_days', 7))
  then
    raise exception 'وضعیت نوبتی که بیش از ۷ روز از آن گذشته قابل تغییر نیست.';
  end if;
  return new;
end;
$$;

create trigger appointments_edit_window
  before update on public.appointments
  for each row execute function public.check_appointment_edit_window();

-- --------------------------------------- M-3: ساخت خودکار رکورد مراجع
-- وقتی منشی درخواست سایت را تأیید می‌کند.
--
-- تطبیق با کد ملی است، نه موبایل (Q-5، M-1): کد ملی شناسهٔ مراجع است و
-- موبایل ممکن است خالی باشد یا متعلق به همراه او.
create or replace function public.link_patient_on_confirm()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_patient uuid;
begin
  if new.status <> 'confirmed' or old.status <> 'requested' or new.patient_id is not null then
    return new;
  end if;
  if new.requester_national_id is null then
    return new;
  end if;

  select id into v_patient
  from public.patients where national_id = new.requester_national_id;

  if v_patient is null then
    -- M-3: شمارهٔ درخواست‌کننده فقط وقتی در پروندهٔ مراجع می‌نشیند که مال
    -- خودش باشد. وگرنه شمارهٔ پسر در پروندهٔ پدر جا می‌افتاد و بعد خودِ
    -- پسر که مراجع می‌شد، ثبتش رد می‌شد.
    --
    -- و اگر آن موبایل قبلاً مال مراجع دیگری باشد، تأیید باید انجام شود و
    -- فقط mobile خالی بماند — قید unique نباید جلوی ثبت نوبت را بگیرد.
    insert into public.patients (full_name, national_id, mobile, created_by)
    values (
      new.requester_name,
      new.requester_national_id,
      case
        when new.requested_for_self is true
         and not exists (select 1 from public.patients p where p.mobile = new.requester_mobile)
        then new.requester_mobile
        else null
      end,
      new.created_by
    )
    returning id into v_patient;
  end if;

  new.patient_id := v_patient;
  return new;
end;
$$;

create trigger appointments_link_patient
  before update on public.appointments
  for each row execute function public.link_patient_on_confirm();
