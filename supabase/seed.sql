-- ============================================================================
-- داده ساختگی — بند ۶ CLAUDE.md
--
-- ⚠️ هیچ نام، شماره تلفن، کد ملی یا اطلاعات مالی واقعی اینجا نیست.
-- نام‌ها ترکیب‌های رایج فارسی‌اند، شماره‌ها الگوی ساختگی دارند، و
-- کدهای ملی عمداً با رقم کنترل درست ساخته نشده‌اند تا با هیچ کد واقعی
-- اشتباه گرفته نشوند.
--
-- این فایل را در SQL Editor داشبورد اجرا کنید، نه با db push.
-- ============================================================================

-- --------------------------------------------------------- تنظیمات پایه
insert into public.app_settings (key, value) values
  ('slot_minutes', '15'),
  ('reminder_hour', '18'),
  ('survey_valid_days', '30'),
  ('past_edit_days', '7'),
  ('site_request_daily_limit', '3')
on conflict (key) do nothing;

-- Q-1: شنبه = ۰ ، چهارشنبه = ۴
insert into public.working_hours (weekday, start_time, end_time) values
  (0, '11:00', '17:00'),
  (4, '11:00', '17:00');

insert into public.insurance_types (name) values
  ('آزاد'), ('تأمین اجتماعی'), ('خدمات درمانی');

insert into public.payment_methods (name) values
  ('کارت‌خوان'), ('کارت‌به‌کارت');

-- H-6: یازده کلید. logo_url عمداً نیست — مطب هنوز لوگو ندارد و
-- «کلید خالی» یعنی ردیفش وجود ندارد، نه رشتهٔ خالی.
insert into public.site_info (key, value) values
  ('address', 'تهران، خیابان نمونه، کوچه آزمایشی، پلاک ۱۲، طبقه دوم'),
  ('phone', '۰۲۱۱۲۳۴۵۶۷۸'),
  ('whatsapp_url', 'https://wa.me/989120000000'),
  ('instagram_url', 'https://instagram.com/example_clinic'),
  ('doctor_name', 'دکتر نمونه'),
  ('specialty_title', 'متخصص طب فیزیکی و توان‌بخشی'),
  ('medical_council_number', '۱۲۳۴۵۶'),
  ('doctor_focus', 'درمان دردهای مزمن ستون فقرات و توان‌بخشی پس از جراحی'),
  ('about_text', 'این متن نمونه است و پیش از راه‌اندازی با متن واقعی پزشک جایگزین می‌شود.'),
  ('directions', 'از ایستگاه مترو نمونه، خروجی شمالی، ۵ دقیقه پیاده به سمت شرق.');

insert into public.faq_items (question, answer, keywords, sort_order) values
  ('برای گرفتن نوبت چه کار کنم؟', 'از طریق صفحه «دریافت نوبت» در همین سایت درخواست بدهید. منشی پس از بررسی با شما تماس می‌گیرد.', array['نوبت','وقت','رزرو'], 1),
  ('ساعات کاری مطب چه زمانی است؟', 'شنبه و چهارشنبه، ساعت ۱۱ تا ۱۷.', array['ساعت','زمان','کاری'], 2),
  ('آیا بیمه قبول می‌شود؟', 'بله. تأمین اجتماعی و خدمات درمانی پذیرفته می‌شوند. برای جزئیات با مطب تماس بگیرید.', array['بیمه','تأمین اجتماعی','خدمات درمانی'], 3),
  ('هزینه ویزیت چقدر است؟', 'برای اطلاع از تعرفه روز، لطفاً با مطب تماس بگیرید.', array['هزینه','تعرفه','قیمت'], 4),
  ('آدرس مطب کجاست؟', 'نشانی و راه رسیدن در صفحه «تماس» همین سایت آمده است.', array['آدرس','نشانی','کجا'], 5),
  ('نوبتم را چطور لغو کنم؟', 'با شماره مطب تماس بگیرید. لغو از طریق سایت ممکن نیست.', array['لغو','کنسل'], 6),
  ('آیا فیزیوتراپی هم انجام می‌شود؟', 'خدمات توان‌بخشی ارائه می‌شود. برای بررسی وضعیت شما، ابتدا ویزیت لازم است.', array['فیزیوتراپی','توان‌بخشی'], 7),
  ('چقدر زودتر باید برسم؟', 'ده دقیقه پیش از ساعت نوبت کافی است.', array['زودتر','تأخیر','رسیدن'], 8);

-- --------------------------------------------------------------- مراجعان
-- M-1: دو نفر عمداً mobile خالی دارند — سالمند و کودکی که شماره شخصی ندارند.
-- M-6: birth_date و gender اختیاری‌اند و بعضی ردیف‌ها ندارند.
insert into public.patients (full_name, mobile, national_id, birth_date, gender, insurance_type_id)
select v.full_name, v.mobile, v.national_id, v.birth_date, v.gender,
       (select id from public.insurance_types where name = v.ins)
from (values
  ('زهرا احمدی',        '09120000001', '1000000001', date '1985-03-12', 'female', 'تأمین اجتماعی'),
  ('محمد رضایی',        '09120000002', '1000000002', date '1978-07-01', 'male',   'آزاد'),
  ('فاطمه کریمی',       '09120000003', '1000000003', date '1992-11-20', 'female', 'خدمات درمانی'),
  ('علی موسوی',         '09120000004', '1000000004', date '1965-01-05', 'male',   'تأمین اجتماعی'),
  ('مریم حسینی',        '09120000005', '1000000005', date '1990-05-18', 'female', 'آزاد'),
  ('رضا نوری',          '09120000006', '1000000006', date '1982-09-30', 'male',   'تأمین اجتماعی'),
  ('سمیه قاسمی',        '09120000007', '1000000007', date '1975-02-14', 'female', 'خدمات درمانی'),
  ('حسین جعفری',        '09120000008', '1000000008', date '1988-12-09', 'male',   'آزاد'),
  ('نرگس شریفی',        '09120000009', '1000000009', date '1995-06-22', 'female', 'تأمین اجتماعی'),
  ('امیر صادقی',        '09120000010', '1000000010', date '1970-04-03', 'male',   'آزاد'),
  ('لیلا میرزایی',      '09120000011', '1000000011', date '1986-08-17', 'female', 'خدمات درمانی'),
  ('سعید بهرامی',       '09120000012', '1000000012', date '1993-10-25', 'male',   'تأمین اجتماعی'),
  ('الهام نجفی',        '09120000013', '1000000013', date '1980-01-29', 'female', 'آزاد'),
  ('مهدی اکبری',        '09120000014', '1000000014', date '1972-03-08', 'male',   'تأمین اجتماعی'),
  ('پریسا یوسفی',       '09120000015', '1000000015', date '1998-07-11', 'female', 'خدمات درمانی'),
  ('بهرام سلطانی',      '09120000016', '1000000016', date '1960-05-06', 'male',   'آزاد'),
  ('شیرین عباسی',       '09120000017', '1000000017', date '1991-09-14', 'female', 'تأمین اجتماعی'),
  ('کاظم رحیمی',        '09120000018', '1000000018', date '1968-11-02', 'male',   'خدمات درمانی'),
  -- این دو شماره شخصی ندارند؛ شماره همراهشان روی نوبت ثبت می‌شود (M-1، A-4)
  ('اقدس طاهری',        null,          '1000000019', date '1941-02-19', 'female', 'تأمین اجتماعی'),
  ('آرش طاهری',         null,          '1000000020', date '2017-10-07', 'male',   'تأمین اجتماعی')
) as v(full_name, mobile, national_id, birth_date, gender, ins);

-- ----------------------------------------------------------------- نوبت‌ها
-- بیست نوبت گذشته با وضعیت‌های مختلف + ده نوبت آینده.
-- A-4: requester_mobile روی همه پر است. دو مراجع بی‌شماره، شماره فرزندشان
-- را دارند — و همان شماره بین هر دو مشترک است، که مجاز است.
insert into public.appointments (
  patient_id, requester_name, requester_mobile, requester_national_id, requested_for_self,
  starts_at, ends_at, status, cancel_reason, source
)
select p.id, p.full_name,
       coalesce(p.mobile, '09120000099'),
       p.national_id, true,
       s.starts_at, s.starts_at + interval '15 minutes',
       s.status,
       case when s.status = 'cancelled' then 'cancelled' else null end,
       'panel'
from (values
  ('1000000001', now() - interval '20 days', 'done'),
  ('1000000002', now() - interval '19 days', 'done'),
  ('1000000003', now() - interval '18 days', 'done'),
  ('1000000004', now() - interval '17 days', 'no_show'),
  ('1000000005', now() - interval '16 days', 'done'),
  ('1000000006', now() - interval '15 days', 'done'),
  ('1000000007', now() - interval '14 days', 'cancelled'),
  ('1000000008', now() - interval '13 days', 'done'),
  ('1000000009', now() - interval '12 days', 'done'),
  ('1000000010', now() - interval '11 days', 'done'),
  ('1000000011', now() - interval '10 days', 'done'),
  ('1000000012', now() - interval '9 days',  'no_show'),
  ('1000000013', now() - interval '8 days',  'done'),
  ('1000000014', now() - interval '7 days',  'done'),
  ('1000000015', now() - interval '6 days',  'done'),
  ('1000000019', now() - interval '5 days',  'done'),
  ('1000000020', now() - interval '4 days',  'done'),
  ('1000000016', now() - interval '3 days',  'done'),
  ('1000000017', now() - interval '2 days',  'done'),
  ('1000000018', now() - interval '1 day',   'done'),
  ('1000000001', now() + interval '2 days',  'confirmed'),
  ('1000000003', now() + interval '2 days' + interval '20 minutes', 'confirmed'),
  ('1000000005', now() + interval '3 days',  'confirmed'),
  ('1000000007', now() + interval '3 days' + interval '20 minutes', 'confirmed'),
  ('1000000009', now() + interval '4 days',  'confirmed'),
  ('1000000011', now() + interval '4 days' + interval '20 minutes', 'confirmed'),
  ('1000000013', now() + interval '5 days',  'confirmed'),
  ('1000000019', now() + interval '5 days' + interval '20 minutes', 'confirmed'),
  ('1000000015', now() + interval '6 days',  'confirmed'),
  ('1000000017', now() + interval '6 days' + interval '20 minutes', 'confirmed')
) as s(national_id, starts_at, status)
join public.patients p on p.national_id = s.national_id;

-- دو درخواست تأییدنشده از سایت، برای آزمون صفحه «درخواست‌های نوبت»
insert into public.appointments (
  requester_name, requester_mobile, requester_national_id, requested_for_self,
  starts_at, ends_at, status, source
) values
  ('نگار اسدی', '09120000050', '1000000050', true,
   now() + interval '7 days', now() + interval '7 days' + interval '15 minutes', 'requested', 'site'),
  -- این یکی «برای شخص دیگری» است: دختر برای مادرش نوبت گرفته (M-2)
  ('ربابه اسدی', '09120000050', '1000000051', false,
   now() + interval '8 days', now() + interval '8 days' + interval '15 minutes', 'requested', 'site');

-- ---------------------------------------------------------------- پرداخت‌ها
-- پرداخت‌ها در این فایل نیستند. دلیلش: payments.recorded_by اجباری است و
-- به profiles ارجاع می‌دهد، و profiles به auth.users. حساب‌های پنل در کار
-- p1-10 ساخته می‌شوند، نه اینجا. پس از p1-10 فایل supabase/seed-payments.sql
-- را اجرا کنید.

-- --------------------------------------------------------- پرسش‌های بی‌پاسخ
insert into public.chatbot_unanswered (question, channel) values
  ('آیا شنبه‌ها عصر هم مطب باز است؟', 'site'),
  ('پارکینگ دارید؟', 'telegram'),
  ('برای کودکان هم نوبت می‌دهید؟', 'site');
