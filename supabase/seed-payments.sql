-- ============================================================================
-- داده ساختگی پرداخت‌ها — پس از p1-10 اجرا شود
--
-- چرا جدا: payments.recorded_by اجباری است و به profiles ارجاع می‌دهد.
-- تا حساب‌های doctor@clinic.test و secretary@clinic.test در p1-10 ساخته
-- نشده‌اند و رکورد profiles ندارند، این فایل هیچ ردیفی وارد نمی‌کند.
--
-- ⚠️ هیچ مبلغ یا نام واقعی اینجا نیست — بند ۶ CLAUDE.md
-- ============================================================================

-- H-1: insurance_type_id روی خود پرداخت کپی می‌شود، نه ارجاع زنده.
-- اگر بیمهٔ مراجع بعداً عوض شود، گزارش ماه‌های بسته‌شده نباید تغییر کند.
with ranked as (
  select a.id            as appointment_id,
         a.patient_id,
         a.starts_at,
         p.insurance_type_id,
         row_number() over (order by a.starts_at) as rn
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.status = 'done'
  order by a.starts_at
  limit 15
)
insert into public.payments (patient_id, appointment_id, amount_toman, payment_method_id,
                             insurance_type_id, paid_at, recorded_by)
select r.patient_id,
       r.appointment_id,
       (array[3500000, 4500000, 5000000, 2500000, 6000000])[1 + (r.rn::int % 5)],
       (select id from public.payment_methods
         where name = case when r.rn % 2 = 0 then 'کارت‌خوان' else 'کارت‌به‌کارت' end),
       r.insurance_type_id,
       r.starts_at + interval '30 minutes',
       (select user_id from public.profiles order by role desc limit 1)
from ranked r
-- اگر هنوز هیچ رکورد profiles نیست، این شرط کل insert را خالی می‌کند
where exists (select 1 from public.profiles);

-- یک ثبت معکوس — آینهٔ دقیق ردیف اصلی طبق H-2 و H-3.
-- trigger payments_reversal_check این را بررسی می‌کند: مبلغ قرینه، همان روش
-- پرداخت و همان مراجع و همان بیمه، و همان paid_at.
insert into public.payments (patient_id, appointment_id, amount_toman, payment_method_id,
                             insurance_type_id, paid_at, recorded_by, reverses_payment_id, note)
select orig.patient_id, orig.appointment_id, -orig.amount_toman, orig.payment_method_id,
       orig.insurance_type_id, orig.paid_at, orig.recorded_by, orig.id,
       'اصلاح مبلغ اشتباه — داده ساختگی'
from public.payments orig
where orig.reverses_payment_id is null
  and not exists (select 1 from public.payments r where r.reverses_payment_id = orig.id)
order by orig.paid_at
limit 1;
-- دو پرداخت با تاریخ امروز.
--
-- چرا لازم است: طبق H-4 منشی فقط پرداخت‌های امروز را می‌بیند. همهٔ
-- پرداخت‌های بالا تاریخ گذشته دارند، پس نمای منشی خالی درمی‌آمد و نفر
-- سوم نمی‌توانست صفحه‌اش را آزمون کند.
with picked as (
  select a.id as appointment_id, a.patient_id, p.insurance_type_id,
         row_number() over (order by a.starts_at desc) as rn
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.status = 'done'
    and not exists (select 1 from public.payments y where y.appointment_id = a.id)
  limit 2
)
insert into public.payments (patient_id, appointment_id, amount_toman, payment_method_id,
                             insurance_type_id, paid_at, recorded_by, note)
select k.patient_id, k.appointment_id,
       (array[4500000, 3500000])[k.rn::int],
       (select id from public.payment_methods
         where name = case when k.rn = 1 then 'کارت‌خوان' else 'کارت‌به‌کارت' end),
       k.insurance_type_id,
       now() - make_interval(hours => k.rn::int),
       (select user_id from public.profiles where role = 'secretary' limit 1),
       'پرداخت امروز — داده ساختگی برای آزمون نمای منشی'
from picked k
where exists (select 1 from public.profiles where role = 'secretary');
