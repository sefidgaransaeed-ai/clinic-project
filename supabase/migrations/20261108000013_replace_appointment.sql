-- تغییر نام تقویم: لغو نوبت قبلی و ثبت نوبت تازه در یک تراکنش.
-- هیچ خطایی بلعیده نمی‌شود؛ شکست INSERT، UPDATE قبلی را هم برمی‌گرداند.
-- SECURITY INVOKER: نشست پزشک/منشی و همهٔ سیاست‌های RLS حفظ می‌شوند.
create or replace function public.replace_appointment(
  p_appointment_id uuid,
  p_patient_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_requester_mobile text,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_patient_name text;
  v_old public.appointments%rowtype;
  v_cancelled_id uuid;
  v_new_id uuid;
begin
  if v_actor is null or not public.is_staff() or not exists (
    select 1 from public.profiles p
    where p.user_id = v_actor and p.is_active
  ) then
    raise exception using errcode = '42501',
      message = 'این عملیات فقط برای پزشک و منشیِ فعال مجاز است.';
  end if;

  if p_starts_at is null or p_ends_at is null
     or not isfinite(p_starts_at) or not isfinite(p_ends_at)
     or p_ends_at <= p_starts_at then
    raise exception using errcode = '22023', message = 'بازهٔ زمانی نوبت معتبر نیست.';
  end if;
  if p_requester_mobile is null or p_requester_mobile !~ '^09\d{9}$' then
    raise exception using errcode = '22023',
      message = 'شمارهٔ تماس این نوبت باید ۱۱ رقم باشد و با ۰۹ شروع شود.';
  end if;

  -- مراجع پیش از فراخوانی پیدا یا ساخته می‌شود. نام و سازندهٔ نوبت از کلاینت نمی‌آیند.
  select p.full_name into v_patient_name
  from public.patients p where p.id = p_patient_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'مراجع انتخاب‌شده پیدا نشد.';
  end if;

  -- UPDATE قفل ردیف را تا پایان تراکنش نگه می‌دارد. فراخوانی دوم پس از انتظار،
  -- شرط status را دوباره می‌سنجد و نمی‌تواند همان نوبت را دوباره جایگزین کند.
  -- قفل ۷ روزهٔ RLS و trigger بدون تغییر اعمال می‌شوند.
  update public.appointments
  set status = 'cancelled', cancel_reason = 'cancelled'
  where id = p_appointment_id and status = 'confirmed'
  returning id into v_cancelled_id;

  if not found then
    select * into v_old from public.appointments where id = p_appointment_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'نوبت قبلی پیدا نشد.';
    elsif v_old.status <> 'confirmed' then
      raise exception using errcode = '55000',
        message = 'وضعیت نوبت عوض شده است. صفحه را تازه کنید و دوباره بررسی کنید.';
    else
      raise exception using errcode = 'P0001',
        message = 'مهلت تغییر این نوبت تمام شده است.';
    end if;
  end if;

  -- قواعد ساعت کاری، تعطیلی و گام ثبت دستی طبق A-2/A-6 در لایهٔ برنامه‌اند.
  -- هم‌پوشانی این INSERT را قید appointments_no_overlap می‌گیرد؛ خطای 23P01
  -- به فراخواننده می‌رسد و کل عملیات، از جمله لغو بالا، rollback می‌شود.
  insert into public.appointments (
    patient_id, requester_name, requester_mobile, starts_at, ends_at,
    status, source, created_by, clinic_id, note
  ) values (
    p_patient_id, v_patient_name, p_requester_mobile, p_starts_at, p_ends_at,
    'confirmed', 'panel', v_actor, public.clinic_for_moment(p_starts_at),
    nullif(btrim(p_note), '')
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke execute on function public.replace_appointment(uuid, uuid, timestamptz, timestamptz, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.replace_appointment(uuid, uuid, timestamptz, timestamptz, text, text)
  to authenticated;

comment on function public.replace_appointment(uuid, uuid, timestamptz, timestamptz, text, text) is
  'جایگزینی اتمی نوبت تأییدشده؛ شکست ثبت تازه، نوبت قبلی را حفظ می‌کند. فقط نشست پزشک/منشی فعال.';
