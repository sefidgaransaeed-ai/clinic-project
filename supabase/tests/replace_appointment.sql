-- فقط دادهٔ ساختگی. استثنای پایانی عمدی است و همهٔ داده‌های این آزمون را rollback می‌کند.
-- اجرا با run-replace-appointment.mjs، که migration را هم در همین تراکنش می‌گذارد.
do $test$
declare
  v_doctor uuid := gen_random_uuid();
  v_secretary uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_patient_a uuid := gen_random_uuid();
  v_patient_b uuid := gen_random_uuid();
  v_method uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
  v_old uuid := gen_random_uuid();
  v_blocker uuid := gen_random_uuid();
  v_expired uuid := gen_random_uuid();
  v_first uuid;
  v_second uuid;
  v_start timestamptz := date_trunc('minute', now()) + interval '50 years'
    + trunc(random() * 100000) * interval '15 minutes';
  v_before jsonb;
  v_count bigint;
  v_cases integer := 0;
  v_signature text := 'public.replace_appointment(uuid,uuid,timestamptz,timestamptz,text,text)';
begin
  if has_function_privilege('anon', v_signature, 'execute')
     or has_function_privilege('service_role', v_signature, 'execute')
     or not has_function_privilege('authenticated', v_signature, 'execute')
     or (select prosecdef from pg_proc where oid = v_signature::regprocedure) then
    raise exception 'TEST_FAILED: function grants or SECURITY INVOKER';
  end if;
  v_cases := v_cases + 1;

  -- شناسه‌ها تصادفی‌اند؛ هیچ حساب موجودی تغییر نمی‌کند. ایمیل‌ها قابل ارسال نیستند.
  insert into auth.users (id, email, raw_app_meta_data) values
    (v_doctor, v_doctor::text || '@atomic-test.invalid', '{"role":"doctor"}'),
    (v_secretary, v_secretary::text || '@atomic-test.invalid', '{"role":"secretary"}'),
    (v_inactive, v_inactive::text || '@atomic-test.invalid', '{"role":"secretary"}');
  insert into public.profiles (user_id, full_name, role, is_active, must_change_password) values
    (v_doctor, 'آزمون اتمی پزشک', 'doctor', true, false),
    (v_secretary, 'آزمون اتمی منشی', 'secretary', true, false),
    (v_inactive, 'آزمون اتمی غیرفعال', 'secretary', false, false);
  insert into public.patients (id, full_name, national_id, created_by) values
    (v_patient_a, 'آزمون اتمی مراجع اول', lpad(trunc(random() * 10000000000)::bigint::text, 10, '0'), v_doctor),
    (v_patient_b, 'آزمون اتمی مراجع دوم', lpad(trunc(random() * 10000000000)::bigint::text, 10, '0'), v_doctor);

  -- حتی اگر دادهٔ نمونهٔ دیگری در آیندهٔ دور باشد، بازهٔ آزمون با آن تداخل نکند.
  while exists (
    select 1 from public.appointments
    where status in ('confirmed', 'arrived', 'done')
      and (tstzrange(starts_at, ends_at, '[)') && tstzrange(v_start, v_start + interval '3 hours', '[)')
        or tstzrange(starts_at, ends_at, '[)') && tstzrange(v_start - interval '100 years', v_start - interval '100 years' + interval '15 minutes', '[)'))
  ) loop
    v_start := v_start + interval '1 day';
  end loop;

  insert into public.appointments (
    id, patient_id, requester_name, requester_mobile, starts_at, ends_at,
    status, source, created_by, note
  ) values
    (v_old, v_patient_a, 'آزمون اتمی مراجع اول', '09000000000', v_start, v_start + interval '15 minutes', 'confirmed', 'panel', v_doctor, 'original'),
    (v_blocker, v_patient_a, 'آزمون اتمی مراجع اول', '09000000000', v_start + interval '2 hours', v_start + interval '3 hours', 'confirmed', 'panel', v_doctor, 'blocker'),
    (v_expired, v_patient_a, 'آزمون اتمی مراجع اول', '09000000000', v_start - interval '100 years', v_start - interval '100 years' + interval '15 minutes', 'confirmed', 'panel', v_doctor, 'expired');
  insert into public.payment_methods (id, name) values (v_method, 'atomic-test-' || v_method);
  insert into public.payments (id, patient_id, appointment_id, amount_toman, payment_method_id, paid_at, recorded_by)
  values (v_payment, v_patient_a, v_old, 100, v_method, now(), v_doctor);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_doctor, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'doctor'))::text, true);
  set local role authenticated;

  -- موفقیت پزشک، همان بازه؛ نام، سازنده و مطب از سمت دیتابیس تعیین شوند.
  v_first := public.replace_appointment(v_old, v_patient_b, v_start, v_start + interval '15 minutes', '09000000001', '  replacement  ');
  if not exists (select 1 from public.appointments where id = v_old and status = 'cancelled' and cancel_reason = 'cancelled' and patient_id = v_patient_a and requester_mobile = '09000000000' and note = 'original')
     or not exists (select 1 from public.appointments where id = v_first and status = 'confirmed' and source = 'panel' and patient_id = v_patient_b and requester_name = 'آزمون اتمی مراجع دوم' and requester_mobile = '09000000001' and created_by = v_doctor and note = 'replacement' and clinic_id is not distinct from public.clinic_for_moment(v_start))
     or not exists (select 1 from public.payments where id = v_payment and appointment_id = v_old and patient_id = v_patient_a and amount_toman = 100) then
    raise exception 'TEST_FAILED: doctor replacement or original/payment preservation';
  end if;
  v_cases := v_cases + 1;

  -- همان عملیات با نقش منشی و یادداشت خالی.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_secretary, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'secretary'))::text, true);
  v_second := public.replace_appointment(v_first, v_patient_a, v_start, v_start + interval '15 minutes', '09000000000', '  ');
  if not exists (select 1 from public.appointments where id = v_first and status = 'cancelled')
     or not exists (select 1 from public.appointments where id = v_second and status = 'confirmed' and created_by = v_secretary and note is null) then
    raise exception 'TEST_FAILED: secretary replacement';
  end if;
  v_cases := v_cases + 1;

  select to_jsonb(a) into v_before from public.appointments a where id = v_second;
  select count(*) into v_count from public.appointments where created_by in (v_doctor, v_secretary);

  -- مهم‌ترین آزمون: INSERT جدید به قید هم‌پوشانی بخورد؛ لغو قبلی هم باید برگردد.
  begin
    perform public.replace_appointment(v_second, v_patient_b, v_start + interval '2 hours', v_start + interval '2 hours 15 minutes', '09000000001');
    raise exception 'TEST_FAILED: overlap accepted';
  exception when exclusion_violation then
    null;
  end;
  if (select to_jsonb(a) from public.appointments a where id = v_second) is distinct from v_before
     or (select count(*) from public.appointments where created_by in (v_doctor, v_secretary)) <> v_count then
    raise exception 'TEST_FAILED: failed insertion did not restore exact old row';
  end if;
  v_cases := v_cases + 1;

  -- فراخوانی مجدد روی همان نوبت قدیمی نباید نوبت دوم بسازد.
  begin
    perform public.replace_appointment(v_first, v_patient_b, v_start + interval '1 hour', v_start + interval '1 hour 15 minutes', '09000000001');
    raise exception 'TEST_FAILED: already replaced appointment accepted';
  exception when sqlstate '55000' then
    null;
  end;
  if (select count(*) from public.appointments where created_by in (v_doctor, v_secretary)) <> v_count then
    raise exception 'TEST_FAILED: duplicate replacement created a row';
  end if;
  v_cases := v_cases + 1;

  begin
    perform public.replace_appointment(v_second, v_patient_b, v_start, v_start, '09000000001');
    raise exception 'TEST_FAILED: invalid interval accepted';
  exception when invalid_parameter_value then null;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.replace_appointment(v_second, v_patient_b, v_start, v_start + interval '15 minutes', null);
    raise exception 'TEST_FAILED: missing contact accepted';
  exception when invalid_parameter_value then null;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.replace_appointment(v_second, gen_random_uuid(), v_start, v_start + interval '15 minutes', '09000000001');
    raise exception 'TEST_FAILED: missing patient accepted';
  exception when no_data_found then null;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.replace_appointment(gen_random_uuid(), v_patient_b, v_start, v_start + interval '15 minutes', '09000000001');
    raise exception 'TEST_FAILED: missing appointment accepted';
  exception when no_data_found then null;
  end;
  v_cases := v_cases + 1;

  -- قفل مهلت ویرایش حتی برای پزشک برقرار است.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_doctor, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'doctor'))::text, true);
  begin
    perform public.replace_appointment(v_expired, v_patient_b, v_start + interval '1 hour', v_start + interval '1 hour 15 minutes', '09000000001');
    raise exception using errcode = 'PZ002', message = 'TEST_FAILED: expired appointment accepted';
  exception when sqlstate 'P0001' then null;
  end;
  if not exists (select 1 from public.appointments where id = v_expired and status = 'confirmed' and cancel_reason is null) then
    raise exception 'TEST_FAILED: expired appointment changed';
  end if;
  v_cases := v_cases + 1;

  -- نقش موجود در JWT به‌تنهایی برای حساب غیرفعال کافی نیست.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_inactive, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'secretary'))::text, true);
  begin
    perform public.replace_appointment(v_second, v_patient_b, v_start, v_start + interval '15 minutes', '09000000001');
    raise exception 'TEST_FAILED: inactive account accepted';
  exception when insufficient_privilege then null;
  end;
  v_cases := v_cases + 1;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_secretary, 'role', 'authenticated', 'app_metadata', '{}'::jsonb)::text, true);
  begin
    perform public.replace_appointment(v_second, v_patient_b, v_start, v_start + interval '15 minutes', '09000000001');
    raise exception 'TEST_FAILED: non-staff account accepted';
  exception when insufficient_privilege then null;
  end;
  v_cases := v_cases + 1;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform public.replace_appointment(v_second, v_patient_b, v_start, v_start + interval '15 minutes', '09000000001');
    raise exception 'TEST_FAILED: anonymous caller accepted';
  exception when insufficient_privilege then null;
  end;
  reset role;
  v_cases := v_cases + 1;

  if (select to_jsonb(a) from public.appointments a where id = v_second) is distinct from v_before
     or (select count(*) from public.appointments where created_by in (v_doctor, v_secretary)) <> v_count then
    raise exception 'TEST_FAILED: rejected operations changed appointments';
  end if;

  -- عمداً خطا: هم fixtures و هم migration داخل رانر برمی‌گردند. هیچ COMMIT وجود ندارد.
  raise exception using errcode = 'PZ001',
    message = 'ATOMIC_REPLACEMENT_TESTS_PASSED: ' || v_cases;
end;
$test$;
