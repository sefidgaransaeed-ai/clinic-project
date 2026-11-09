-- ============================================================================
-- RLS و قاعده‌های دسترسی — پیاده‌سازی جدول خلاصه مجوزهای بخش ۹ سند
--
-- سه قاعدهٔ کلی که در همهٔ این فایل رعایت شده:
--   ۱. هیچ policy حذف (delete) وجود ندارد — حذف برای هیچ نقشی مجاز نیست
--   ۲. anon به هیچ جدولی دسترسی مستقیم ندارد — فقط توابع فایل 0002
--   ۳. کنترل دسترسی اینجاست، نه در مخفی‌کردن دکمه (بند ۵ CLAUDE.md)
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.patients           enable row level security;
alter table public.appointments       enable row level security;
alter table public.working_hours      enable row level security;
alter table public.closures           enable row level security;
alter table public.app_settings       enable row level security;
alter table public.insurance_types    enable row level security;
alter table public.payment_methods    enable row level security;
alter table public.payments           enable row level security;
alter table public.faq_items          enable row level security;
alter table public.site_info          enable row level security;
alter table public.chatbot_unanswered enable row level security;
alter table public.surveys            enable row level security;
alter table public.bot_links          enable row level security;
alter table public.reminder_log       enable row level security;

-- anon هیچ دسترسی مستقیمی ندارد؛ فقط execute روی توابع مشخص
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, authenticated;

-- ---------------------------------------------------------------- profiles
create policy profiles_self_read on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy profiles_doctor_read_all on public.profiles
  for select to authenticated using (public.is_doctor());
create policy profiles_doctor_insert on public.profiles
  for insert to authenticated with check (public.is_doctor());
create policy profiles_doctor_update on public.profiles
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

-- ---------------------------------------------------------------- patients
create policy patients_staff_read on public.patients
  for select to authenticated using (public.is_staff());
create policy patients_staff_insert on public.patients
  for insert to authenticated with check (public.is_staff());
create policy patients_staff_update on public.patients
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------ appointments
create policy appointments_staff_read on public.appointments
  for select to authenticated using (public.is_staff());
create policy appointments_staff_insert on public.appointments
  for insert to authenticated with check (public.is_staff());

-- A-3: هفت روز پس از ends_at هیچ تغییر وضعیتی ممکن نیست — نه done، نه
-- no_show، نه arrived، نه cancelled. این تنها قاعدهٔ ثبت نوبت است که در
-- پایگاه داده اجبار می‌شود؛ بقیه طبق A-2 در کد می‌مانند.
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (
    public.is_staff()
    and ends_at > now() - make_interval(days => public.setting_int('past_edit_days', 7))
  )
  with check (public.is_staff());

-- ------------------------------------------------- تنظیمات: منشی فقط می‌بیند
create policy working_hours_staff_read on public.working_hours
  for select to authenticated using (public.is_staff());
create policy working_hours_doctor_write on public.working_hours
  for insert to authenticated with check (public.is_doctor());
create policy working_hours_doctor_update on public.working_hours
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

create policy closures_staff_read on public.closures
  for select to authenticated using (public.is_staff());
create policy closures_doctor_write on public.closures
  for insert to authenticated with check (public.is_doctor());
create policy closures_doctor_update on public.closures
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

create policy app_settings_staff_read on public.app_settings
  for select to authenticated using (public.is_staff());
create policy app_settings_doctor_write on public.app_settings
  for insert to authenticated with check (public.is_doctor());
create policy app_settings_doctor_update on public.app_settings
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

create policy insurance_types_staff_read on public.insurance_types
  for select to authenticated using (public.is_staff());
create policy insurance_types_doctor_write on public.insurance_types
  for insert to authenticated with check (public.is_doctor());
create policy insurance_types_doctor_update on public.insurance_types
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

create policy payment_methods_staff_read on public.payment_methods
  for select to authenticated using (public.is_staff());
create policy payment_methods_doctor_write on public.payment_methods
  for insert to authenticated with check (public.is_doctor());
create policy payment_methods_doctor_update on public.payment_methods
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

-- ---------------------------------------------------------------- payments
-- H-4 و سند 0010: پزشک همه را می‌بیند، منشی فقط پرداخت‌های امروز.
-- «امروز» به وقت Asia/Tehran، نه UTC.
--
-- بستن صفحهٔ گزارش کافی نبود: منشی همهٔ ردیف‌ها را می‌دید و فهرست
-- پرداخت‌ها فیلتر بازهٔ تاریخ دارد، پس عملاً جمع ماه را حساب می‌کرد.
create policy payments_doctor_read on public.payments
  for select to authenticated using (public.is_doctor());

create policy payments_secretary_read_today on public.payments
  for select to authenticated using (
    public.current_app_role() = 'secretary'
    and (paid_at at time zone 'Asia/Tehran')::date = public.tehran_today()
  );

create policy payments_staff_insert on public.payments
  for insert to authenticated with check (public.is_staff());

-- هیچ policy update یا delete روی payments نیست.
-- اصلاح فقط با ثبت ردیف معکوس انجام می‌شود.

-- ------------------------------------------------- سایت و چت‌بات و بازخورد
create policy faq_items_staff_read on public.faq_items
  for select to authenticated using (public.is_staff());
create policy faq_items_doctor_write on public.faq_items
  for insert to authenticated with check (public.is_doctor());
create policy faq_items_doctor_update on public.faq_items
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

create policy site_info_staff_read on public.site_info
  for select to authenticated using (public.is_staff());
create policy site_info_doctor_write on public.site_info
  for insert to authenticated with check (public.is_doctor());
create policy site_info_doctor_update on public.site_info
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

-- H-7: ستون «رسیدگی شد» عمداً اضافه نشد. فهرست انبار می‌شود و خالی
-- نمی‌شود، پس صفحهٔ /panel/chatbot باید صفحه‌بندی داشته باشد.
create policy chatbot_unanswered_staff_read on public.chatbot_unanswered
  for select to authenticated using (public.is_staff());

-- منشی هیچ دسترسی مستقیمی به surveys ندارد — برای همین تابع
-- done_appointments_without_survey در فایل 0002 وجود دارد (H-10)
create policy surveys_doctor_read on public.surveys
  for select to authenticated using (public.is_doctor());

-- ---------------------------------------------------------------- ربات
create policy bot_links_doctor_read on public.bot_links
  for select to authenticated using (public.is_doctor());
create policy reminder_log_doctor_read on public.reminder_log
  for select to authenticated using (public.is_doctor());

-- ============================================================ اجازهٔ توابع
-- فقط همین شش تابع برای anon قابل فراخوانی‌اند
grant execute on function public.available_slots(date)                      to anon, authenticated;
grant execute on function public.request_appointment(text, text, text, timestamptz, boolean) to anon, authenticated;
grant execute on function public.get_public_info()                          to anon, authenticated;
grant execute on function public.get_survey(text)                           to anon, authenticated;
grant execute on function public.submit_survey(text, smallint, text)        to anon, authenticated;
grant execute on function public.log_unanswered_question(text, text)        to anon, authenticated;

-- و این سه فقط برای کاربر واردشده
grant execute on function public.done_appointments_without_survey(int) to authenticated;
grant execute on function public.create_survey_link(uuid)              to authenticated;
grant execute on function public.finance_report(date, date)            to authenticated;
