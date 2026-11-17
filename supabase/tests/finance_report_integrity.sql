-- Synthetic fixtures and schema changes are always rolled back by the final exception.
do $tests$
declare
  doctor_id uuid := gen_random_uuid();
  secretary_id uuid := gen_random_uuid();
  patient_id uuid := gen_random_uuid();
  method_a uuid := gen_random_uuid();
  method_b uuid := gen_random_uuid();
  insurance_id uuid := gen_random_uuid();
  original_id uuid := gen_random_uuid();
  today_id uuid := gen_random_uuid();
  yesterday_id uuid := gen_random_uuid();
  future_id uuid := gen_random_uuid();
  day_key date := public.tehran_today()+18000;
  at_start timestamptz;
  today_at timestamptz := (public.tehran_today()+time '12:00') at time zone 'Asia/Tehran';
  report jsonb;
  cases int := 0;
begin
  while exists(select 1 from public.payments p where (p.paid_at at time zone 'Asia/Tehran')::date between day_key-1 and day_key+5)
  loop day_key := day_key+7; end loop;
  at_start := day_key::timestamp at time zone 'Asia/Tehran';
  insert into auth.users(id,email,raw_app_meta_data) values
    (doctor_id,doctor_id||'@finance-test.invalid','{"role":"doctor"}'),
    (secretary_id,secretary_id||'@finance-test.invalid','{"role":"secretary"}');
  insert into public.profiles(user_id,full_name,role,is_active,must_change_password) values
    (doctor_id,'پزشک ساختگی مالی','doctor',true,false),
    (secretary_id,'منشی ساختگی مالی','secretary',true,false);
  insert into public.patients(id,full_name,national_id,created_by)
    values(patient_id,'مراجع ساختگی مالی',lpad(trunc(random()*10000000000)::bigint::text,10,'0'),doctor_id);
  insert into public.payment_methods(id,name,is_active) values
    (method_a,'fixture-a-'||method_a,true),(method_b,'fixture-b-'||method_b,false);
  insert into public.insurance_types(id,name,is_active) values(insurance_id,'fixture-'||insurance_id,false);

  -- Original and its correction cancel; an independent refund reduces net but not count.
  insert into public.payments(id,patient_id,amount_toman,payment_method_id,paid_at,recorded_by)
    values(original_id,patient_id,100000,method_a,at_start+interval '12 hours',doctor_id);
  insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
    values(patient_id,-100000,method_a,at_start+interval '12 hours',doctor_id,original_id);
  insert into public.payments(patient_id,amount_toman,payment_method_id,insurance_type_id,paid_at,recorded_by) values
    (patient_id,200000,method_b,insurance_id,at_start,doctor_id),
    (patient_id,-50000,method_b,insurance_id,at_start+interval '23 hours 59 minutes 59 seconds',doctor_id),
    (patient_id,7,method_b,null,at_start+interval '1 day',doctor_id);

  perform set_config('request.jwt.claims',jsonb_build_object('sub',doctor_id,'role','authenticated','app_metadata',jsonb_build_object('role','doctor'))::text,true);
  set local role authenticated;
  report := public.finance_report(day_key,day_key);
  if report->>'net_total' is distinct from '150000' or report->>'count' is distinct from '1' or report->>'average' is distinct from '150000' then
    raise exception 'TEST_FAILED: corrected payment or refund totals'; end if;
  cases := cases+1;
  if jsonb_array_length(report->'by_method') is distinct from 1 or report#>>'{by_method,0,id}' is distinct from method_b::text
    or report#>>'{by_method,0,total}' is distinct from '150000' or report#>>'{by_method,0,count}' is distinct from '1' then
    raise exception 'TEST_FAILED: method grouping and zero group filtering'; end if;
  cases := cases+1;
  if jsonb_array_length(report->'by_insurance') is distinct from 1 or report#>>'{by_insurance,0,id}' is distinct from insurance_id::text
    or report#>>'{by_insurance,0,count}' is distinct from '1' then
    raise exception 'TEST_FAILED: inactive insurance history'; end if;
  cases := cases+1;
  if report#>>'{daily,0,day}' is distinct from day_key::text or report#>>'{daily,0,total}' is distinct from '150000'
    or report#>>'{daily,0,count}' is distinct from '1' then raise exception 'TEST_FAILED: daily totals'; end if;
  cases := cases+1;
  report := public.finance_report(day_key+1,day_key+1);
  if report->>'net_total' is distinct from '7' or report->>'count' is distinct from '1'
    or report#>'{by_insurance,0,id}' is distinct from 'null'::jsonb then
    raise exception 'TEST_FAILED: Tehran midnight or uninsured group'; end if;
  cases := cases+1;
  report := public.finance_report(day_key+2,day_key+4);
  if report->>'net_total' is distinct from '0' or report->>'count' is distinct from '0' or report->>'average' is distinct from '0'
    or report->'by_method' is distinct from '[]'::jsonb or jsonb_array_length(report->'daily') is distinct from 3
    or report#>>'{daily,2,count}' is distinct from '0' then raise exception 'TEST_FAILED: empty date range'; end if;
  cases := cases+1;
  begin perform public.finance_report(day_key+1,day_key);
    raise exception 'TEST_FAILED: reversed date range accepted';
  exception when invalid_parameter_value then null; end;
  cases := cases+1;
  begin perform public.finance_report(null,day_key);
    raise exception 'TEST_FAILED: null date range accepted';
  exception when invalid_parameter_value then null; end;
  cases := cases+1;

  -- Negative-half rounding must match the UI's Math.round(-1.5) = -1.
  insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by) values
    (patient_id,1,method_b,at_start+interval '2 days',doctor_id),
    (patient_id,1,method_b,at_start+interval '2 days',doctor_id),
    (patient_id,-5,method_b,at_start+interval '2 days',doctor_id);
  report := public.finance_report(day_key+2,day_key+2);
  if report->>'net_total' is distinct from '-3' or report->>'count' is distinct from '2' or report->>'average' is distinct from '-1' then
    raise exception 'TEST_FAILED: negative average rounding'; end if;
  cases := cases+1;
  insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by)
    values(patient_id,-99,method_b,at_start+interval '3 days',doctor_id);
  report := public.finance_report(day_key+3,day_key+3);
  if report->>'net_total' is distinct from '-99' or report->>'count' is distinct from '0' or report->>'average' is distinct from '0'
    or report#>>'{by_method,0,total}' is distinct from '-99' then raise exception 'TEST_FAILED: refund only range'; end if;
  cases := cases+1;

  insert into public.payments(id,patient_id,amount_toman,payment_method_id,paid_at,recorded_by) values
    (today_id,patient_id,300,method_a,today_at,doctor_id),
    (yesterday_id,patient_id,400,method_a,today_at-interval '1 day',doctor_id),
    (future_id,patient_id,500,method_a,today_at+interval '1 day',doctor_id);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',secretary_id,'role','authenticated','app_metadata',jsonb_build_object('role','secretary'))::text,true);
  if exists(select 1 from public.payments where id in (yesterday_id,future_id)) then
    raise exception 'TEST_FAILED: secretary sees non-today payments'; end if;
  cases := cases+1;
  -- Explicit known values deliberately bypass the UI's original-payment lookup.
  begin
    insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
      values(patient_id,-400,method_a,today_at-interval '1 day',secretary_id,yesterday_id);
    raise exception 'TEST_FAILED: secretary reversed yesterday directly';
  exception when insufficient_privilege then null; end;
  cases := cases+1;
  begin
    insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
      values(patient_id,-500,method_a,today_at+interval '1 day',secretary_id,future_id);
    raise exception 'TEST_FAILED: secretary reversed tomorrow directly';
  exception when insufficient_privilege then null; end;
  cases := cases+1;
  insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
    values(patient_id,-300,method_a,today_at,secretary_id,today_id);
  cases := cases+1;
  begin
    insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
      values(patient_id,-300,method_a,today_at,secretary_id,today_id);
    raise exception 'TEST_FAILED: duplicate reversal accepted';
  exception when unique_violation then null; end;
  cases := cases+1;
  begin perform public.finance_report(day_key,day_key);
    raise exception 'TEST_FAILED: secretary read report';
  exception when raise_exception then
    if sqlerrm  is distinct from  'گزارش مالی فقط برای پزشک است.' then raise; end if; end;
  cases := cases+1;
  set local role anon;
  begin perform public.finance_report(day_key,day_key);
    raise exception 'TEST_FAILED: anonymous read report';
  exception when insufficient_privilege then null; end;
  cases := cases+1;
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',doctor_id,'role','authenticated','app_metadata',jsonb_build_object('role','doctor'))::text,true);
  insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
    values(patient_id,-400,method_a,today_at-interval '1 day',doctor_id,yesterday_id);
  cases := cases+1;
  begin
    insert into public.payments(patient_id,amount_toman,payment_method_id,paid_at,recorded_by,reverses_payment_id)
      values(patient_id,-499,method_a,today_at+interval '1 day',doctor_id,future_id);
    raise exception 'TEST_FAILED: mismatched reversal amount accepted';
  exception when raise_exception then
    if sqlerrm  is distinct from  'مبلغ ثبت معکوس باید دقیقاً قرینهٔ مبلغ اصلی باشد.' then raise; end if; end;
  cases := cases+1;
  reset role;
  raise exception using errcode='PZ001',message='FINANCE_INTEGRITY_TESTS_PASSED: '||cases;
end; $tests$;
