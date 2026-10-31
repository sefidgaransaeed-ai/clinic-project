-- ============================================================================
-- مطب‌ها و برنامهٔ هفتگی واقعی — تصمیم 0011
--
-- ⚠️ این مقدارها **واقعی‌اند، نه ساختگی**، و این خلاف بند ۶ CLAUDE.md نیست.
-- تصمیم 0007 نام و تخصص و شمارهٔ نظام پزشکی و تلفن و نشانی پزشک را
-- «اطلاعات منتشرشدهٔ کسب‌وکار» دانست — نه دادهٔ شخصی — و پزشک موافقت کرده.
-- بند ۶ دربارهٔ دادهٔ بیمار است: نام، شماره، کد ملی و پروندهٔ مراجعان.
--
-- چرا این‌جا و نه در seed.sql: آن فایل داده ساختگی برای آزمون است و با
-- هر بازنشانی دوباره اجرا می‌شود. این یکی **پیکربندی واقعی مطب** است.
--
-- این فایل idempotent است و می‌شود چند بار اجرایش کرد.
-- ============================================================================

insert into public.clinics (name, address, directions, sort_order) values
  ('مطب مرزداران',
   'تهران، مرزداران، بین البرز و سرسبز شمالی، جنب متروی مرزداران، پلاک ۶۷، طبقهٔ ۲',
   'جنب ایستگاه متروی مرزداران.',
   1),
  ('مطب ظفر',
   'تهران، تقاطع خیابان دستگردی (ظفر) و خیابان شریعتی، برج نگین ظفر',
   null,
   2)
on conflict (name) do update
  set address    = excluded.address,
      directions = excluded.directions,
      sort_order = excluded.sort_order;

-- ------------------------------------------------- برنامهٔ هفتگی واقعی
-- Q-1: شنبه = ۰ تا جمعه = ۶
--
-- ساعت‌های قبلی (شنبه و چهارشنبه ۱۱ تا ۱۷) مقدار جای‌نگه‌دار بودند و
-- با برنامهٔ واقعی پزشک نمی‌خواندند.
delete from public.working_hours;

insert into public.working_hours (weekday, start_time, end_time, clinic_id)
select v.weekday, v.start_time, v.end_time, c.id
from (values
  (0, time '14:00', time '18:00', 'مطب ظفر'),
  (1, time '15:30', time '19:00', 'مطب مرزداران'),
  (3, time '15:30', time '19:00', 'مطب مرزداران'),
  (4, time '14:00', time '18:00', 'مطب ظفر')
) as v(weekday, start_time, end_time, clinic_name)
join public.clinics c on c.name = v.clinic_name;

-- ------------------------------------------- اطلاعات واقعی سایت
-- چرا لازم است: نفر سوم همین مقدارها را در src/modules/site/content.ts
-- گذاشته بود. اگر جدول site_info ساختگی می‌ماند، در کار p3-13 که سایت از
-- پایگاه داده می‌خواند، سایت واقعی ناگهان «دکتر نمونه» نشان می‌داد.
--
-- نشانی و راه رسیدن دیگر اینجا نیستند — از تصمیم 0011 به بعد جای هر دو
-- مطب در جدول clinics است و site_info جای یکی بیشتر نداشت.
delete from public.site_info where key in ('address', 'directions', 'about_text');

insert into public.site_info (key, value) values
  ('phone',                  '09386925601'),
  ('whatsapp_url',           'https://wa.me/989386925601'),
  ('instagram_url',          'https://www.instagram.com/dr.sanaz.hamidipanah/'),
  ('doctor_name',            'دکتر ساناز حمیدی‌پناه'),
  ('specialty_title',        'متخصص طب فیزیکی و توان‌بخشی'),
  ('doctor_focus',           'ستون فقرات و مفاصل'),
  ('medical_council_number', '159798')
on conflict (key) do update set value = excluded.value;

-- about_text و logo_url عمداً نیستند:
--   about_text — متنش هنوز نوشته نشده، و «کلید خالی» یعنی ردیف نباشد (H-6)
--   logo_url   — لوگو در PR #34 به صورت فایل در src/modules/site/assets آمده،
--                نه نشانی. اگر روزی روی Storage رفت، این کلید اضافه می‌شود.

-- ---------------------------------------- مطبِ نوبت‌های ساختگی موجود
-- داده ساختگی پیش از این تصمیم ساخته شده و clinic_id ندارد.
update public.appointments a
   set clinic_id = public.clinic_for_moment(a.starts_at)
 where a.clinic_id is null;
