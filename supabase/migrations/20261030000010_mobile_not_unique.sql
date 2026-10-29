-- ============================================================================
-- شمارهٔ مراجع دیگر یکتا نیست — تصمیم M-7
--
-- ===========================  دو شماره داریم  ===============================
--
--   appointments.requester_mobile   «شمارهٔ تماس این نوبت»
--                                    اجباری · تکراری مجاز · برای هر نوبت جدا
--
--   patients.mobile                 «شمارهٔ پروندهٔ مراجع»
--                                    اختیاری · از این پس تکراری مجاز
--
-- این دو هیچ‌وقت یکی نبوده‌اند، ولی چون هر دو «موبایل» صدا زده می‌شدند،
-- بحثشان چهار بار از صفر شروع شد. هر جا در کد یا رابط کاربری این‌ها را
-- می‌نویسید، **نام کاملشان را بنویسید**.
-- ============================================================================
--
-- چرا یکتایی برداشته شد:
--
--   ۱. هویت مراجع **کد ملی** است، نه موبایل. آن یکتاست و رقم کنترل دارد.
--      یکتایی موبایل چیزی به هویت اضافه نمی‌کرد.
--
--   ۲. هزینهٔ روزانه داشت. مطب طب فیزیکی پر از سالمند و کودک است؛ منشی
--      هنگام ثبتشان شمارهٔ همراهشان را می‌زد و رد می‌شد.
--
--   ۳. داده را دروغ‌گو می‌کرد. مطب شمارهٔ آن کودک را **دارد**؛ سامانه
--      می‌گفت نداری. نتیجه‌اش یادداشت روی کاغذ کنار دست منشی بود، که از
--      یک شمارهٔ تکراری در پایگاه داده بدتر است.
--
-- و آن چیزی که این قید ظاهراً محافظت می‌کرد — ابهام ربات — از اول وجود
-- داشت: `requester_mobile` هیچ‌وقت یکتا نبود، پس مرحلهٔ دوم تطبیق `M-5`
-- همیشه می‌توانست چند مراجع برگرداند. تصمیم `M-7` آن را هم حل می‌کند:
-- ربات دیگر آدم را نمی‌شناسد، فقط می‌داند به کدام گوشی پیام بدهد.
-- ============================================================================

alter table public.patients drop constraint if exists patients_mobile_key;

comment on column public.patients.mobile is
  'M-7 — شمارهٔ پروندهٔ مراجع. اختیاری، و تکراری مجاز است: اعضای یک خانواده می‌توانند یک گوشی داشته باشند. هویت مراجع national_id است، نه این.';

-- جست‌وجوی منشی با شماره باید سریع بماند، حالا که دیگر ایندکس یکتا نیست
create index if not exists patients_mobile_idx on public.patients (mobile);

-- ---------------------------------------- ساده‌شدن trigger تأیید درخواست
--
-- نسخهٔ قبلی پیش از کپی‌کردن شماره، بررسی می‌کرد مبادا مال مراجع دیگری
-- باشد — چون قید یکتا ثبت را رد می‌کرد. حالا که قید نیست، آن بررسی هم
-- لازم نیست.
--
-- تنها شرطی که می‌ماند همان `M-3` است: شماره فقط وقتی در پروندهٔ مراجع
-- می‌نشیند که **مال خودش** باشد. وگرنه شمارهٔ پسر در پروندهٔ پدر جا
-- می‌افتاد و بعدها کسی فکر می‌کرد پدر با آن شماره در دسترس است.
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

  -- تطبیق با کد ملی است، نه موبایل (Q-5، M-1): کد ملی شناسهٔ مراجع است.
  select id into v_patient
  from public.patients where national_id = new.requester_national_id;

  if v_patient is null then
    insert into public.patients (full_name, national_id, mobile, created_by)
    values (
      new.requester_name,
      new.requester_national_id,
      -- M-3: فقط اگر نوبت برای خودِ درخواست‌دهنده است
      case when new.requested_for_self is true then new.requester_mobile else null end,
      new.created_by
    )
    returning id into v_patient;
  end if;

  new.patient_id := v_patient;
  return new;
end;
$$;
