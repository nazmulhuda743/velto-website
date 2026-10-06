-- STAGING ONLY. Every fixture and mutation rolls back; no outbound notification commits.
begin;
do $$
declare actor uuid; rider uuid; rider2 uuid; worker uuid; r jsonb; r2 jsonb; data jsonb; id1 uuid; id2 uuid;
 n bigint; before_start timestamptz; v integer; day date:=(now() at time zone 'Asia/Dhaka')::date+2;
 ord text; phone text; existing uuid; a public.ops_appointments;
begin
 select id into actor from public.profiles where active and role='admin' limit 1;
 select id into rider from public.profiles where active and role='manager' order by id limit 1;
 select id into rider2 from public.profiles where active and role='manager' and id<>rider order by id limit 1;
 select id into worker from public.profiles where active and role='worker' limit 1;
 insert into public.website_riders(profile_id,can_ride) values(rider,true),(rider2,true),(worker,true) on conflict(profile_id) do update set can_ride=true;
 delete from public.website_rider_days_off where website_rider_days_off.day=(now() at time zone 'Asia/Dhaka')::date+2 and profile_id in (rider,rider2,worker);
 select order_number into ord from public.orders where order_status='Ready' limit 1;
 assert actor is not null and rider2 is not null and worker is not null and ord is not null,'Missing staging fixtures';
 select count(*) into n from public.customers;
 data:=jsonb_build_object('kind','pickup','name','Scheduler QA caller','phone','01900009987','area','Sector 11','address','QA fixture only',
 'outlet_code','S11','source','phone','start',(day+time '09:00') at time zone 'Asia/Dhaka','end',(day+time '09:30') at time zone 'Asia/Dhaka','assignee_id',rider);
 r:=public.ops_scheduler_save(actor,data); assert (r->>'ok')::boolean,'New pickup: '||r::text;id1:=(r->>'id')::uuid;
 assert (select customer_id is null from public.ops_appointments where id=id1),'New customer must be nullable';
 assert (select count(*) from public.customers)=n,'No canonical customer inserted';
 assert exists(select 1 from public.tasks where dedupe_key='scheduler:'||id1::text),'Canonical task missing';
 r2:=public.ops_scheduler_save(actor,data); assert r2->>'error'='rider_conflict','Same rider conflict: '||r2::text;
 assert (select count(*) from public.ops_appointments where contact_name='Scheduler QA caller')=1,'Failed save left orphan';
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('assignee_id',rider2));assert (r2->>'ok')::boolean,'Different rider: '||r2::text;id2:=(r2->>'id')::uuid;
 select version,scheduled_start into v,before_start from public.ops_appointments where id=id2;
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('id',id2,'version',v));assert r2->>'error'='rider_conflict','Reassign must conflict';
 assert (select assignee_id=rider2 and scheduled_start=before_start from public.ops_appointments where id=id2),'Failed reassign lost original';
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('id',id2,'version',v,'assignee_id',rider2,'start',(day+time '10:00') at time zone 'Asia/Dhaka','end',(day+time '10:30') at time zone 'Asia/Dhaka'));
 assert (r2->>'ok')::boolean,'Successful reschedule: '||r2::text;
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('id',id2,'version',v));assert r2->>'error'='stale_version','Stale edit must fail';
 r:=public.ops_scheduler_save(actor,data||jsonb_build_object('start',(day+time '10:00') at time zone 'Asia/Dhaka','end',(day+time '10:30') at time zone 'Asia/Dhaka'));assert (r->>'ok')::boolean,'Set old-time rider fixture';
 -- Moving to a different rider at a free new time must not check the old interval.
 select version into v from public.ops_appointments where id=id2;
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('id',id2,'version',v,'assignee_id',rider,'start',(day+time '11:30') at time zone 'Asia/Dhaka','end',(day+time '12:00') at time zone 'Asia/Dhaka'));
 assert (r2->>'ok')::boolean,'Valid time + rider change: '||r2::text;

 select version into v from public.ops_appointments where id=id1;
 r:=public.ops_scheduler_transition(actor,id1,v,'cancelled','QA cancellation');assert (r->>'ok')::boolean,'Cancel: '||r::text;
 assert (select status='cancelled' from public.ops_appointments where id=id1),'Keep cancel history';
 r:=public.ops_scheduler_save(actor,data);assert (r->>'ok')::boolean,'Cancellation frees rider: '||r::text;
 select c.phone,c.id into phone,existing from public.customers c where c.phone~'^01[3-9][0-9]{8}$' limit 1;
 r:=public.ops_scheduler_save(actor,data||jsonb_build_object('phone','+88'||phone,'assignee_id',null));assert (r->>'ok')::boolean,'Existing pickup: '||r::text;
 assert (select customer_id=existing from public.ops_appointments where id=(r->>'id')::uuid),'Existing customer not linked';
 assert (select count(*) from public.customers)=n,'Duplicate customer inserted';
 r:=public.ops_scheduler_save(actor,data||jsonb_build_object('assignee_id',null,'promised_window','morning','start',(day+time '14:00') at time zone 'Asia/Dhaka','end',(day+time '14:30') at time zone 'Asia/Dhaka'));
 assert r->>'error'='outside_customer_window','Outside promise: '||r::text;
 r:=public.ops_scheduler_save(actor,data||jsonb_build_object('assignee_id',null,'promised_window','morning','override_reason','Customer confirmed afternoon','start',(day+time '14:00') at time zone 'Asia/Dhaka','end',(day+time '14:30') at time zone 'Asia/Dhaka'));
 assert (r->>'ok')::boolean,'Override: '||r::text;
 data:=jsonb_build_object('kind','processing','order_number',ord,'outlet_code','S11','processing_stage','ironing','source','manager','assignee_id',worker,
 'start',(day+time '10:00') at time zone 'Asia/Dhaka','end',(day+time '11:30') at time zone 'Asia/Dhaka');
 r:=public.ops_scheduler_save(actor,data);assert (r->>'ok')::boolean,'Processing: '||r::text;id1:=(r->>'id')::uuid;
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('start',(day+time '11:00') at time zone 'Asia/Dhaka','end',(day+time '12:00') at time zone 'Asia/Dhaka'));
 assert r2->>'error'='worker_conflict','Duration overlap: '||r2::text;
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('assignee_id',rider2));assert (r2->>'ok')::boolean,'Other worker allowed: '||r2::text;
 r2:=public.ops_scheduler_save(actor,data||jsonb_build_object('start',(day+time '11:30') at time zone 'Asia/Dhaka','end',(day+time '12:00') at time zone 'Asia/Dhaka'));
 assert (r2->>'ok')::boolean,'Adjacent interval allowed: '||r2::text;
 r:=public.ops_scheduler_save(worker,data);assert r->>'error'='permission_denied','Unauthorized actor';
 assert not has_function_privilege('authenticated','public.ops_scheduler_save(uuid,jsonb)','EXECUTE'),'No direct client access';
 assert not has_table_privilege('anon','public.ops_appointments','SELECT'),'No public data';
 assert exists(select 1 from public.website_admin_activity where target=id1::text and action='appointment_insert'),'Audit missing';

 -- Processing completion is a work label and cannot promote an order.
 select version into v from public.ops_appointments where id=id1;
 r:=public.ops_scheduler_transition(actor,id1,v,'completed','QA processing complete');assert (r->>'ok')::boolean,'Processing complete: '||r::text;
 assert (select order_status='Ready' from public.orders where order_number=ord),'Processing changed order';
 -- A single real profile cannot work across lanes at the same instant.
 data:=jsonb_build_object('kind','delivery','order_number',ord,'outlet_code','S11','source','manager','assignee_id',rider,
 'start',(day+time '10:00') at time zone 'Asia/Dhaka','end',(day+time '10:30') at time zone 'Asia/Dhaka');
 r:=public.ops_scheduler_save(actor,data);assert r->>'error'='rider_conflict','Cross-lane overlap: '||r::text;
 -- Completion must use the canonical order + dispatch + task path.
 r:=public.ops_scheduler_save(actor,data||jsonb_build_object('assignee_id',rider2,'start',(day+time '15:00') at time zone 'Asia/Dhaka','end',(day+time '15:30') at time zone 'Asia/Dhaka'));
 assert (r->>'ok')::boolean,'Delivery create: '||r::text;id1:=(r->>'id')::uuid;
 select version into v from public.ops_appointments where id=id1;
 r:=public.ops_scheduler_transition(actor,id1,v,'in_progress','');assert (r->>'ok')::boolean,'Delivery start: '||r::text;
 select version into v from public.ops_appointments where id=id1;
 r:=public.ops_scheduler_transition(actor,id1,v,'completed','QA delivered');assert (r->>'ok')::boolean,'Delivery complete: '||r::text;
 assert (select order_status='Delivered' from public.orders where order_number=ord),'Canonical delivery status missing';
 assert exists(select 1 from public.ops_appointments ap join public.website_dispatch_jobs j on j.id=ap.dispatch_job_id where ap.id=id1 and ap.status='completed' and j.stage='done'),'Canonical dispatch completion missing';
 -- Support can read transport but cannot see processing, override, or change settings.
 insert into public.website_admin_members(user_id,email,name,role,origin,created_by)
 select worker,email,'QA support','support','existing','Scheduler test' from auth.users where id=worker
 on conflict(user_id) do update set role='support',active=true;
 r:=public.ops_scheduler_board(worker,day);assert (r->>'ok')::boolean and not (r->>'can_process')::boolean,'Support board';
 assert not exists(select 1 from jsonb_array_elements(r->'appointments') x where x->>'kind'='processing'),'Support sees processing';
 r:=public.ops_scheduler_settings(worker,15,'09:00','22:00');assert r->>'error'='permission_denied','Support settings';
 r:=public.ops_scheduler_save(worker,data||jsonb_build_object('kind','processing','processing_stage','qc'));assert r->>'error'='permission_denied','Support processing';
 r:=public.ops_scheduler_save(worker,data||jsonb_build_object('override_reason','QA'));assert r->>'error'='permission_denied','Support override';
 r:=public.ops_scheduler_board(actor,day);assert (r->>'ok')::boolean,'Board: '||r::text;

 -- Configurable grid is anchored to the configured working start, not wall-clock minutes.
 r:=public.ops_scheduler_settings(actor,30,'09:15','22:00');assert (r->>'ok')::boolean,'Settings save';
 data:=jsonb_build_object('kind','pickup','name','Scheduler grid QA','phone','01900009982','area','Sector 11','address','Rollback grid fixture',
 'outlet_code','S11','source','phone','start',(day+time '09:15') at time zone 'Asia/Dhaka','end',(day+time '09:45') at time zone 'Asia/Dhaka','assignee_id',null);
 r:=public.ops_scheduler_save(actor,data);assert (r->>'ok')::boolean,'Working-start grid: '||r::text;
 r:=public.ops_scheduler_save(actor,data||jsonb_build_object('start',(day+time '09:30') at time zone 'Asia/Dhaka','end',(day+time '10:00') at time zone 'Asia/Dhaka'));
 assert r->>'error'='invalid_time','Off-grid create';
 raise notice 'MANAGER_SCHEDULER_TESTS_PASSED';
end $$;
rollback;
