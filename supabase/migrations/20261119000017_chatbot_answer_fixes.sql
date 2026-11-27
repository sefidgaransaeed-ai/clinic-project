-- اصلاح پاسخ‌ها و کلیدواژه‌های چت‌بات — بازبینی ۶ آذر ۱۴۰۵
--
-- چرا:
--   ۱. پاسخ «شماره تلفن و راه‌های تماس» شمارهٔ قدیمی ۰۹۱۲۰۱۴۰۶۳۵ را می‌گفت،
--      در حالی که `site_info.phone` عدد ۰۹۳۸۶۹۲۵۶۰۱ است. مراجع با شمارهٔ غلط
--      تماس می‌گرفت؛ این بدترین نوع پاسخ غلط است.
--   ۲. `get_public_info` ستون `keywords` جدول `faq_items` را برنمی‌گرداند، پس
--      چت‌بات کلیدواژه‌های پزشک را اصلاً نمی‌دید و فقط تطبیق تحت‌اللفظی داشت:
--      «ساعت کاریتون چنده؟» و «شنبه باز هستید؟» بی‌پاسخ می‌ماند، ولی آزمون‌های
--      واحد با کلیدواژهٔ ساختگی سبز بودند. کلیدواژه‌ها محتوای عمومی‌اند
--      (همان واژه‌های جست‌وجو) و برگرداندنشان داده‌ای لو نمی‌دهد.
--   ۳. کلیدواژه‌های مترو و دسترسی به پرسش آدرس اضافه شد؛ هر دو مطب کنار مترو
--      هستند و این پرسش رایج است.
--
-- نصب: پس از ادغام، توسط نفر اول. حذف داده‌ای در کار نیست؛ فقط متن و کلیدواژه.

update public.faq_items
set answer = 'شمارهٔ تماس مطب ۰۹۳۸۶۹۲۵۶۰۱ است. نشانی و راه‌های ارتباطی در بخش «تماس» و پایین همهٔ صفحه‌ها آمده است.'
where question = 'شماره تلفن و راه‌های تماس با مطب چیست؟';

update public.faq_items
set keywords = array(select distinct k from unnest(keywords || array['مترو', 'دسترسی', 'مسیر', 'راه']) as k order by k)
where question = 'آدرس مطب کجاست؟';

-- همان تابع مهاجرت ۱۴، فقط با `keywords` در هر پرسش.
create or replace function public.get_public_info()
returns jsonb
language sql stable
security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question', f.question, 'answer', f.answer, 'keywords', f.keywords)
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
