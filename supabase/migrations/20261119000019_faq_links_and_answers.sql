-- لینک در پاسخ‌های پرتکرار و اصلاح متن پاسخ‌ها — ۶ آذر ۱۴۰۵
--
-- چرا:
--   ۱. پاسخ‌ها کلی بودند و راه را نشان نمی‌دادند: «برای اطلاع... با مطب تماس
--      بگیرید» برای آدرس و ساعت کاری، در حالی که همان اطلاعات در صفحهٔ تماس
--      هست. پزشک خواست پاسخ‌ها مستقیم به همان صفحه لینک بدهند.
--   ۲. پاسخ «گرفتن نوبت» فقط تلفن را می‌گفت، در حالی که از این نسخه فرم
--      نوبت سایت هم واقعی است (`BOOKING_FORM_READY = true`).
--   ۳. نام مطب‌ها (مرزداران، ظفر)، اینستاگرام و خدمات (طب سوزنی، نوار عصب،
--      تزریق) کلیدواژه نداشتند و چت‌بات پاسخشان را پیدا نمی‌کرد.
--
-- ستون‌های `link_href` و `link_label` به پرسش اضافه می‌شوند (متن دکمهٔ لینک).
-- `link_href` نشانی داخلی سایت است (مثل `/contact`) و رابط سایت آن را
-- با `<Link>` نشان می‌دهد؛ ربات همان را با دامنهٔ سایت کامل می‌کند.

alter table public.faq_items
  add column if not exists link_href text,
  add column if not exists link_label text;

-- ------------------------------------------------------------ نوبت

update public.faq_items
set answer = 'دو راه دارید: از صفحهٔ «نوبت» همین سایت درخواست بدهید، یا با شمارهٔ مطب تماس بگیرید؛ منشی هم وقت را هماهنگ می‌کند.',
    link_href = '/nobat',
    link_label = 'گرفتن نوبت از سایت',
    keywords = keywords || array['نوبت آنلاین', 'نوبت اینترنتی', 'از سایت', 'فرم نوبت', 'آنلاین', 'سایت', 'اینترنتی']
where question = 'برای گرفتن نوبت چه کار کنم؟';

-- ------------------------------------------------------------ ساعت کاری

update public.faq_items
set answer = 'زمان‌های حضور هر مطب (مرزداران و ظفر) در صفحهٔ «تماس» آمده است. برای هماهنگی نهایی هم با مطب تماس بگیرید.',
    link_href = '/contact',
    link_label = 'زمان‌های حضور پزشک',
    keywords = keywords || array['ساعت حضور', 'ساعت پزشک', 'زمان حضور', 'حضور پزشک', 'ساعات حضور', 'شیفت']
where question = 'ساعات کاری مطب چه زمانی است؟';

-- ------------------------------------------------------------ آدرس

update public.faq_items
set answer = 'نشانی هر دو مطب، با راه رسیدن و نزدیک‌ترین ایستگاه مترو، در صفحهٔ «تماس» آمده است.',
    link_href = '/contact',
    link_label = 'آدرس مطب‌ها و راه رسیدن',
    keywords = keywords || array['مرزداران', 'ظفر', 'پارکینگ', 'آدرس مطب', 'نشانی مطب']
where question = 'آدرس مطب کجاست؟';

-- ------------------------------------------------------------ تماس

update public.faq_items
set answer = 'شمارهٔ تماس مطب ۰۹۳۸۶۹۲۵۶۰۱ است. واتس‌اپ و اینستاگرام مطب هم در صفحهٔ «تماس» و پایین صفحه‌ها لینک شده‌اند.',
    link_href = '/contact',
    link_label = 'راه‌های تماس',
    keywords = keywords || array['اینستاگرام', 'پیج', 'صفحه', 'شبکه اجتماعی', 'دایرکت']
where question = 'شماره تلفن و راه‌های تماس با مطب چیست؟';

-- ------------------------------------------------------------ پزشک

update public.faq_items
set link_href = '/about',
    link_label = 'دربارهٔ دکتر',
    keywords = keywords || array['دکتر کیه', 'خانم دکتر', 'مرد دکتر', 'بیوگرافی', 'رزومه']
where question = 'دکتر چه تخصصی دارند و کجا معرفی شده‌اند؟';

-- ------------------------------------------------------------ هزینه

update public.faq_items
set link_href = '/contact',
    link_label = 'تماس برای تعرفه'
where question = 'هزینه ویزیت چقدر است؟';

-- ------------------------------------------------------------ خدمات

insert into public.faq_items (question, answer, keywords, sort_order, link_href, link_label)
select
  'چه خدماتی در مطب انجام می‌شود؟',
  'تزریق داخل مفصلی و ستون فقرات (اوزون، پی‌آرپی، ژل)، نوار عصب و عضله، طب سوزنی و لیزردرمانی، حرکات اصلاحی و تجویز کفی. برای اینکه بدانید کدام روش به درد شما می‌خورد، ویزیت لازم است.',
  array['خدمات', 'طب سوزنی', 'سوزن', 'نوار عصب', 'نوار عضله', 'تزریق', 'پی آر پی', 'prp', 'اوزون',
        'لیزر', 'لیزرتراپی', 'کفی', 'حرکات اصلاحی', 'ورزش درمانی', 'درمان', 'روش‌های درمان'],
  11,
  '/services',
  'خدمات و روش‌های درمان'
where not exists (
  select 1 from public.faq_items where question = 'چه خدماتی در مطب انجام می‌شود؟'
);

-- ------------------------------------------------------------ تابع عمومی

create or replace function public.get_public_info()
returns jsonb
language sql stable
security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question', f.question, 'answer', f.answer, 'keywords', f.keywords,
               'link_href', f.link_href, 'link_label', f.link_label)
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
