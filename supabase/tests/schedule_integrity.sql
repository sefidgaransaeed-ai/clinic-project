-- Run through run-schedule-integrity.mjs. The final exception rolls back schema and fixtures.
do $tests$
declare
  v_doctor uuid := gen_random_uuid();
  v_secretary uuid := gen_random_uuid();
  v_clinic_a uuid := gen_random_uuid();
  v_clinic_b uuid := gen_random_uuid();
  v_first uuid;
  v_second uuid;
  v_inactive uuid;
  v_closure uuid;
  v_request uuid;
  v_day date := public.tehran_today() + 3650;
  v_start timestamptz;
  v_before jsonb;
  v_rows int;
  v_cases int := 0;
begin
  -- Changes to existing hours/settings are transaction-local and always rolled back.
  update public.working_hours set is_active = false;
  update public.app_settings set value='15' where key='slot_minutes';
  while public.clinic_weekday(v_day) <> 0
    or exists(select 1 from public.closures where closure_date=v_day)
    or exists(select 1 from public.appointments where (starts_at at time zone 'Asia/Tehran')::date=v_day)
  loop v_day := v_day + 1; end loop;
  v_start := (v_day + time '10:00') at time zone 'Asia/Tehran';

  insert into auth.users (id,email,raw_app_meta_data) values
    (v_doctor,v_doctor::text||'@schedule-test.invalid','{"role":"doctor"}'),
    (v_secretary,v_secretary::text||'@schedule-test.invalid','{"role":"secretary"}');
  insert into public.profiles (user_id,full_name,role,is_active,must_change_password) values
    (v_doctor,'پزشک ساختگی آزمون برنامه','doctor',true,false),
    (v_secretary,'منشی ساختگی آزمون برنامه','secretary',true,false);
  insert into public.clinics (id,name,address) values
    (v_clinic_a,'schedule-test-a-'||v_clinic_a,'نشانی ساختگی'),
    (v_clinic_b,'schedule-test-b-'||v_clinic_b,'نشانی ساختگی');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_doctor,'role','authenticated','app_metadata',jsonb_build_object('role','doctor'))::text,true);
  set local role authenticated;

  insert into public.working_hours (weekday,start_time,end_time,clinic_id)
    values(0,'10:00','11:00',v_clinic_a) returning id into v_first;
  insert into public.working_hours (weekday,start_time,end_time,clinic_id)
    values(0,'11:00','12:00',v_clinic_a) returning id into v_second;
  v_cases := v_cases+1; -- Adjacent active shifts in one clinic allowed.

  begin
    insert into public.working_hours (weekday,start_time,end_time,clinic_id) values(0,'10:30','11:30',v_clinic_a);
    raise exception 'TEST_FAILED: active overlap accepted';
  exception when exclusion_violation then null; end;
  v_cases := v_cases+1;
  begin
    update public.working_hours set start_time='10:45' where id=v_second;
    raise exception 'TEST_FAILED: update overlap accepted';
  exception when exclusion_violation then null; end;
  v_cases := v_cases+1;
  begin
    insert into public.working_hours (weekday,start_time,end_time,clinic_id) values(0,'13:00','14:00',v_clinic_b);
    raise exception 'TEST_FAILED: two clinics on same active weekday';
  exception when exclusion_violation then null; end;
  v_cases := v_cases+1;
  begin
    insert into public.working_hours (weekday,start_time,end_time,clinic_id) values(2,'10:00','11:00',null);
    raise exception 'TEST_FAILED: null clinic accepted';
  exception when not_null_violation then null; end;
  v_cases := v_cases+1;

  insert into public.working_hours (weekday,start_time,end_time,clinic_id,is_active)
    values(0,'10:30','11:30',v_clinic_b,false) returning id into v_inactive;
  v_cases := v_cases+1; -- Inactive history does not conflict with active schedule.
  begin
    update public.working_hours set is_active=true where id=v_inactive;
    raise exception 'TEST_FAILED: conflicting reactivation accepted';
  exception when exclusion_violation then null; end;
  v_cases := v_cases+1;
  insert into public.working_hours (weekday,start_time,end_time,clinic_id) values(2,'10:00','11:00',v_clinic_b);
  v_cases := v_cases+1; -- A formerly closed weekday can become a working day.
  if (select count(*) from public.available_slots(v_day))<>8 then
    raise exception 'TEST_FAILED: adjacent shifts produce duplicate or missing slots';
  end if;
  v_cases := v_cases+1;

  insert into public.closures(closure_date,reason,created_by)
    values(v_day,'تعطیلی ساختگی آزمون',v_doctor) returning id into v_closure;
  if not (select is_active from public.closures where id=v_closure)
    or exists(select 1 from public.available_slots(v_day)) then
    raise exception 'TEST_FAILED: active closure did not close slots';
  end if;
  if not ((public.get_public_info()->'closures') @> jsonb_build_array(v_day)) then
    raise exception 'TEST_FAILED: active closure missing from public info';
  end if;
  v_cases := v_cases+1;
  set local role anon;
  begin
    perform public.request_appointment('آزمون تعطیلی','09000000000','0000000000',v_start,false);
    raise exception 'TEST_FAILED: public request accepted active closure';
  exception when raise_exception then
    if sqlerrm not like 'این روز تعطیل است.%' then raise; end if;
  end;
  v_cases := v_cases+1;

  set local role authenticated;
  update public.closures set is_active=false where id=v_closure;
  if not exists(select 1 from public.closures where id=v_closure and not is_active)
    or (select count(*) from public.available_slots(v_day))<>8
    or ((public.get_public_info()->'closures') @> jsonb_build_array(v_day)) then
    raise exception 'TEST_FAILED: cancelled closure history or public filtering';
  end if;
  v_cases := v_cases+1;
  set local role anon;
  v_request := public.request_appointment('آزمون لغو تعطیلی','09000000000','0000000000',v_start,false);
  if v_request is null then raise exception 'TEST_FAILED: request after reopening'; end if;
  v_cases := v_cases+1;
  begin
    update public.closures set is_active=true where id=v_closure;
    raise exception 'TEST_FAILED: anonymous closure write';
  exception when insufficient_privilege then null; end;
  v_cases := v_cases+1;

  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_secretary,'role','authenticated','app_metadata',jsonb_build_object('role','secretary'))::text,true);
  if not exists(select 1 from public.closures where id=v_closure) then
    raise exception 'TEST_FAILED: secretary cannot read closure';
  end if;
  update public.closures set is_active=true where id=v_closure;
  get diagnostics v_rows = row_count;
  if v_rows<>0 then raise exception 'TEST_FAILED: secretary changed closure'; end if;
  v_cases := v_cases+1;
  begin
    insert into public.working_hours(weekday,start_time,end_time,clinic_id) values(5,'10:00','11:00',v_clinic_a);
    raise exception 'TEST_FAILED: secretary created working hours';
  exception when insufficient_privilege then null; end;
  v_cases := v_cases+1;
  update public.working_hours set is_active=false where id=v_first;
  get diagnostics v_rows = row_count;
  if v_rows<>0 then raise exception 'TEST_FAILED: secretary changed hours'; end if;
  v_cases := v_cases+1;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_doctor,'role','authenticated','app_metadata',jsonb_build_object('role','doctor'))::text,true);
  delete from public.closures where id=v_closure;
  get diagnostics v_rows = row_count;
  if v_rows<>0 then raise exception 'TEST_FAILED: doctor deleted closure'; end if;
  v_cases := v_cases+1;
  begin
    insert into public.closures(closure_date,created_by) values(v_day,v_doctor);
    raise exception 'TEST_FAILED: duplicate cancelled closure date';
  exception when unique_violation then null; end;
  v_cases := v_cases+1;

  -- Existing appointments must not be cancelled/moved when configuration changes.
  -- Link a dedicated synthetic patient to avoid matching any existing identity.
  reset role;
  insert into public.patients(full_name,national_id,created_by)
    values('مراجع ساختگی برنامه',lpad(trunc(random()*10000000000)::bigint::text,10,'0'),v_doctor);
  update public.appointments set patient_id=(select id from public.patients where created_by=v_doctor limit 1),status='confirmed' where id=v_request;
  select to_jsonb(a) into v_before from public.appointments a where id=v_request;
  set local role authenticated;
  update public.working_hours set start_time='10:30' where id=v_first;
  update public.closures set is_active=true where id=v_closure;
  if (select to_jsonb(a) from public.appointments a where id=v_request) is distinct from v_before then
    raise exception 'TEST_FAILED: changing settings mutated an appointment';
  end if;
  v_cases := v_cases+1;
  if exists(select 1 from public.available_slots(v_day)) then
    raise exception 'TEST_FAILED: reactivated closure did not close slots';
  end if;
  v_cases := v_cases+1;
  reset role;
  raise exception using errcode='PZ001',message='SCHEDULE_INTEGRITY_TESTS_PASSED: '||v_cases;
end; $tests$;
