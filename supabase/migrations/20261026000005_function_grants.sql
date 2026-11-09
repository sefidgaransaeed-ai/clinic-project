-- ============================================================================
-- اصلاح اجازهٔ اجرای توابع
--
-- چرا این فایل لازم شد: در فایل 0003 نوشته بودیم
--     revoke all on all functions in schema public from anon, authenticated;
-- و فرض کرده بودیم anon دیگر به هیچ تابعی دسترسی ندارد. غلط بود.
--
-- پستگرس هنگام ساخت هر تابع، اجازهٔ execute را به نقش ویژهٔ PUBLIC می‌دهد،
-- نه به anon. گرفتن اجازه از anon آن grant پیش‌فرض را دست نمی‌زند، پس
-- anon همچنان از راه PUBLIC همهٔ ۲۰ تابع را می‌توانست صدا بزند.
--
-- خوشبختانه finance_report و create_survey_link و
-- done_appointments_without_survey نگهبان نقش داخلی داشتند و داده‌ای بیرون
-- نرفت. ولی expire_stale_requests نگهبان نداشت: هر بازدیدکننده‌ای با کلید
-- عمومی می‌توانست همهٔ نوبت‌های «در انتظار» را یک‌جا لغو کند.
--
-- درس: در پایگاه داده «نگرفتن اجازه از یک نقش» با «بسته بودن» یکی نیست.
-- اجازه باید از PUBLIC گرفته شود و بعد دانه‌دانه داده شود.
-- ============================================================================

-- ------------------------------------------- گام ۱: بستن همه روی PUBLIC
-- عمداً تابع‌به‌تابع و با امضای دقیق، نه `all functions in schema public`:
-- افزونهٔ btree_gist هم توابعش در همین schema است و نباید دست بخورد.
--
-- و عمداً هر سه نقش با هم: Supabase یک default privilege دارد که به anon و
-- authenticated و service_role اجازهٔ execute می‌دهد. همین باعث شد revoke
-- فایل 0003 روی چهار تابع trigger بی‌اثر بماند — آنها در فایل 0004 ساخته
-- شدند، یعنی بعد از آن revoke، و اجازهٔ پیش‌فرض را تازه گرفتند.
--
-- گرفتن اجازهٔ execute از توابع trigger بی‌خطر است: پستگرس این اجازه را
-- هنگام create trigger بررسی می‌کند، نه هنگام شلیک trigger.
revoke execute on function public.available_slots(date)                            from public, anon, authenticated;
revoke execute on function public.block_payment_update()                           from public, anon, authenticated;
revoke execute on function public.check_appointment_edit_window()                  from public, anon, authenticated;
revoke execute on function public.check_payment_reversal()                         from public, anon, authenticated;
revoke execute on function public.clinic_weekday(date)                             from public, anon, authenticated;
revoke execute on function public.create_survey_link(uuid)                         from public, anon, authenticated;
revoke execute on function public.current_app_role()                               from public, anon, authenticated;
revoke execute on function public.done_appointments_without_survey(integer)        from public, anon, authenticated;
revoke execute on function public.expire_stale_requests()                          from public, anon, authenticated;
revoke execute on function public.finance_report(date, date)                       from public, anon, authenticated;
revoke execute on function public.get_public_info()                                from public, anon, authenticated;
revoke execute on function public.get_survey(text)                                 from public, anon, authenticated;
revoke execute on function public.is_doctor()                                      from public, anon, authenticated;
revoke execute on function public.is_staff()                                       from public, anon, authenticated;
revoke execute on function public.link_patient_on_confirm()                        from public, anon, authenticated;
revoke execute on function public.log_unanswered_question(text, text)              from public, anon, authenticated;
revoke execute on function public.request_appointment(text, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.setting_int(text, integer)                       from public, anon, authenticated;
revoke execute on function public.submit_survey(text, smallint, text)              from public, anon, authenticated;
revoke execute on function public.tehran_today()                                   from public, anon, authenticated;

-- و برای توابعی که از این پس ساخته می‌شوند، پیش‌فرض «بسته» باشد تا کسی
-- دوباره به همین تله نیفتد. هر تابع تازه باید grant صریح بگیرد.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------- گام ۲: شش تابع عمومی سایت و چت‌بات
-- اینها و فقط اینها از اینترنت و بدون حساب قابل فراخوانی‌اند.
grant execute on function public.available_slots(date)                             to anon, authenticated;
grant execute on function public.request_appointment(text, text, text, timestamptz, boolean) to anon, authenticated;
grant execute on function public.get_public_info()                                 to anon, authenticated;
grant execute on function public.get_survey(text)                                  to anon, authenticated;
grant execute on function public.submit_survey(text, smallint, text)               to anon, authenticated;
grant execute on function public.log_unanswered_question(text, text)               to anon, authenticated;

-- ------------------------------------- گام ۳: توابع پنل، فقط کاربر واردشده
grant execute on function public.done_appointments_without_survey(integer) to authenticated;
grant execute on function public.create_survey_link(uuid)                  to authenticated;
grant execute on function public.finance_report(date, date)                to authenticated;

-- این چهار تا داخل عبارت‌های RLS صدا زده می‌شوند. عبارت policy با هویت
-- خودِ کاربر ارزیابی می‌شود — نه با هویت مالک — پس بدون این grant هر
-- select روی جدول‌های پنل با خطای دسترسی رد می‌شد.
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_doctor()        to authenticated;
grant execute on function public.is_staff()         to authenticated;
grant execute on function public.setting_int(text, integer) to authenticated;
grant execute on function public.tehran_today()     to authenticated;

-- ------------------------------------------- گام ۴: زمان‌بند، فقط service_role
-- مسیر api/cron در کار p1-12 با کلید service_role این را صدا می‌زند.
grant execute on function public.expire_stale_requests() to service_role;

-- و یک لایهٔ دوم داخل خود تابع، تا اگر روزی grant اشتباه داده شد هم
-- فراخوانی از مرورگر رد شود. وقتی تابع از psql یا SQL Editor اجرا شود
-- request.jwt.claims خالی است و شرط رد نمی‌کند.
create or replace function public.expire_stale_requests()
returns integer
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_rows   int;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if v_claims is not null
     and coalesce(v_claims::jsonb ->> 'role', '') <> 'service_role'
  then
    raise exception 'این تابع فقط از مسیر زمان‌بند قابل اجراست.';
  end if;

  update public.appointments a
     set status = 'cancelled', cancel_reason = 'expired'
   where a.status = 'requested'
     and a.starts_at < now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- create or replace اجازه‌ها را بازنشانی نمی‌کند، ولی برای اطمینان دوباره:
revoke execute on function public.expire_stale_requests() from public, anon, authenticated;
grant  execute on function public.expire_stale_requests() to service_role;
