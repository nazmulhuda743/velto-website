-- Additive scheduling attachments. Dispatch, capacity and Ops remain authoritative.
begin;
create extension if not exists btree_gist with schema extensions;
create table if not exists public.ops_scheduler_config (
 id boolean primary key default true check(id), interval_minutes integer not null default 30 check(interval_minutes in (15,30,60)),
 starts_at time not null default '09:00', ends_at time not null default '22:00', check(ends_at>starts_at)
);
insert into public.ops_scheduler_config(id) values(true) on conflict do nothing;
create table if not exists public.ops_appointments (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('pickup','delivery','processing')),
 dispatch_job_id uuid unique references public.website_dispatch_jobs(id),
 order_number text references public.orders(order_number), customer_id uuid references public.customers(id),
 contact_name text not null check(length(contact_name) between 1 and 120), phone_key text, whatsapp text,
 area text, address text, service text, source text not null default 'manager' check(source in ('website','whatsapp','phone','walk-in','manager','weekly')),
 processing_stage text check(processing_stage in ('intake','washing','dry_cleaning','ironing','qc','packing')),
 scheduled_start timestamptz, scheduled_end timestamptz,
 assignee_id uuid references public.profiles(id), outlet_code text references public.outlets(code),
 status text not null default 'scheduled' check(status in ('scheduled','in_progress','completed','cancelled')),
 promised_date date, promised_window text references public.capacity_windows(id),
 notes text not null default '' check(length(notes)<=2000), blocking_reason text not null default '' check(length(blocking_reason)<=300),
 version integer not null default 1, created_by uuid, updated_by uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((scheduled_start is null)=(scheduled_end is null)), check(scheduled_end>scheduled_start),
 check((kind='processing' and order_number is not null and dispatch_job_id is null and processing_stage is not null) or (kind in ('pickup','delivery') and dispatch_job_id is not null)),
 constraint ops_appointments_resource_overlap exclude using gist
   (assignee_id with =, tstzrange(scheduled_start,scheduled_end,'[)') with &&)
   where (assignee_id is not null and scheduled_start is not null and status in ('scheduled','in_progress'))
);
create index if not exists ops_appointments_day_idx on public.ops_appointments(scheduled_start);
create index if not exists ops_appointments_order_idx on public.ops_appointments(order_number);
create index if not exists ops_appointments_customer_idx on public.ops_appointments(customer_id);
create index if not exists ops_appointments_outlet_idx on public.ops_appointments(outlet_code);

-- Explicitly grant the requested managers access; never replace an existing role/deactivation.
insert into public.website_admin_members(user_id,email,name,role,origin,created_by)
 select p.id,u.email,left(coalesce(nullif(p.name,''),u.email),80),'manager','existing','Manager scheduler rollout'
 from public.profiles p join auth.users u on u.id=p.id
 where p.active and p.role='manager' and u.email is not null
 on conflict(user_id) do nothing;

-- These functions are invoker, service-role-only. The actor comes only from the verified server session.
create or replace function public.ops_scheduler_actor(p_actor uuid) returns jsonb
language sql stable set search_path=pg_catalog,public as $$
 select case when p.id is not null and not p.active then null
 when p.role='admin' then jsonb_build_object('id',p_actor,'role','owner','name',coalesce(p.name,'Owner'))
 when m.active and m.role in ('owner','manager','support') then jsonb_build_object('id',p_actor,'role',m.role,'name',m.name)
 else null end from (select p_actor id) a left join public.profiles p on p.id=a.id left join public.website_admin_members m on m.user_id=a.id
$$;

create or replace function public.ops_scheduler_audit() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
declare a jsonb; detail jsonb;
begin
 a:=public.ops_scheduler_actor(nullif(current_setting('velto.scheduler_actor',true),'')::uuid);
 if tg_op='UPDATE' then new.version:=old.version+1; end if;
 new.updated_at:=clock_timestamp(); new.updated_by:=coalesce((a->>'id')::uuid,new.updated_by);
 detail:=jsonb_build_object('kind',new.kind,'before',case when tg_op='UPDATE' then jsonb_build_object('start',old.scheduled_start,'end',old.scheduled_end,'assignee',old.assignee_id,'status',old.status,'version',old.version) end,
 'after',jsonb_build_object('start',new.scheduled_start,'end',new.scheduled_end,'assignee',new.assignee_id,'status',new.status,'version',new.version),
 'reason',nullif(current_setting('velto.scheduler_reason',true),''));
 insert into public.website_admin_activity(actor_id,actor_name,actor_role,section,action,target,summary,detail)
 values((a->>'id')::uuid,coalesce(a->>'name','Velto Ops'),coalesce(a->>'role','system'),'dispatch','appointment_'||lower(tg_op),new.id::text,
 left(initcap(new.kind)||' appointment '||case when tg_op='INSERT' then 'created' else 'updated' end,300),detail);
 return new;
end $$;
drop trigger if exists ops_scheduler_audit on public.ops_appointments;
create trigger ops_scheduler_audit before insert or update on public.ops_appointments for each row execute function public.ops_scheduler_audit();

-- Old Dispatch and customer-self-service paths cannot leave stale exact reservations behind.
create or replace function public.ops_scheduler_dispatch_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.ops_appointments a set
 assignee_id=new.assignee_id, order_number=new.order_number,
 customer_id=coalesce((select o.customer_id from public.orders o where o.order_number=new.order_number),a.customer_id),
 status=case when new.stage in ('picked','done') then 'completed' when new.stage in ('cancelled','merged') then 'cancelled' else a.status end,
 scheduled_start=case when (new.slot_date,new.slot) is distinct from (old.slot_date,old.slot) then null else a.scheduled_start end,
 scheduled_end=case when (new.slot_date,new.slot) is distinct from (old.slot_date,old.slot) then null else a.scheduled_end end
 where a.dispatch_job_id=new.id and (new.assignee_id,new.order_number,new.stage,new.slot_date,new.slot) is distinct from (old.assignee_id,old.order_number,old.stage,old.slot_date,old.slot);
 return null;
end $$;
drop trigger if exists ops_scheduler_dispatch_changed on public.website_dispatch_jobs;
create trigger ops_scheduler_dispatch_changed after update on public.website_dispatch_jobs for each row execute function public.ops_scheduler_dispatch_changed();

create or replace function public.ops_scheduler_save(p_actor uuid,p_data jsonb) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare
 actor jsonb:=public.ops_scheduler_actor(p_actor); a public.ops_appointments; old_a public.ops_appointments;
 j public.website_dispatch_jobs; o public.orders; c public.customers;
 v_id uuid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()); v_kind text:=p_data->>'kind';
 v_start timestamptz; v_end timestamptz; v_day date; v_window text; v_assignee uuid; v_name text; v_result jsonb;
 v_phone text; v_reason text:=nullif(btrim(p_data->>'override_reason'),''); v_task uuid; v_order text; v_job uuid;
 v_promised_date date; v_promised_window text; v_error text; v_role text:=actor->>'role'; cfg public.ops_scheduler_config;
begin
 if actor is null or (v_kind='processing' and v_role='support') then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 if v_kind is null or v_kind not in ('pickup','delivery','processing') or octet_length(p_data::text)>16000 then return jsonb_build_object('ok',false,'error','invalid'); end if;
 if v_reason is not null and v_role not in ('owner','manager') then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 perform set_config('velto.scheduler_actor',p_actor::text,true); perform set_config('velto.scheduler_reason',coalesce(v_reason,''),true);
 -- Stable request UUID protects retry after a lost response.
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 select * into old_a from public.ops_appointments where id=v_id for update;
 if old_a.id is not null then
   if old_a.kind='processing' and v_role='support' then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
   if p_data->>'version' is null and old_a.created_by=p_actor then return jsonb_build_object('ok',true,'id',old_a.id,'repeat',true); end if;
   if old_a.version is distinct from (p_data->>'version')::integer then return jsonb_build_object('ok',false,'error','stale_version'); end if;
   if old_a.kind<>v_kind or old_a.status in ('completed','cancelled') then return jsonb_build_object('ok',false,'error','closed'); end if;
 end if;
 v_start:=(p_data->>'start')::timestamptz; v_end:=(p_data->>'end')::timestamptz;
 v_day:=(v_start at time zone 'Asia/Dhaka')::date;
 select * into cfg from public.ops_scheduler_config where id;
 if v_start is null or v_end is null or v_end<=v_start or v_end-v_start>interval '12 hours' then return jsonb_build_object('ok',false,'error','invalid'); end if;
 if v_start<now() and (old_a.id is null or (v_start,v_end) is distinct from (old_a.scheduled_start,old_a.scheduled_end)) then return jsonb_build_object('ok',false,'error','slot_past'); end if;
 if v_day>(now() at time zone 'Asia/Dhaka')::date+60 or (v_end at time zone 'Asia/Dhaka')::date<>v_day
 or (v_start at time zone 'Asia/Dhaka')::time<cfg.starts_at or (v_end at time zone 'Asia/Dhaka')::time>cfg.ends_at
 or (extract(epoch from ((v_start at time zone 'Asia/Dhaka')::time-cfg.starts_at))/60)::int%cfg.interval_minutes<>0 or extract(second from v_start)<>0 then return jsonb_build_object('ok',false,'error','invalid_time'); end if;
 v_assignee:=nullif(p_data->>'assignee_id','')::uuid;
 if v_assignee is not null then
   select name into v_name from public.profiles where id=v_assignee and active and role in ('admin','manager','worker','rider','ironman');
   if not found then return jsonb_build_object('ok',false,'error','assignee_unavailable'); end if;
   if v_kind<>'processing' and (exists(select 1 from public.website_rider_days_off where profile_id=v_assignee and day=v_day)
     or (exists(select 1 from public.website_riders where can_ride) and not exists(select 1 from public.website_riders where profile_id=v_assignee and can_ride))) then
     return jsonb_build_object('ok',false,'error','assignee_unavailable'); end if;
 end if;
 if not exists(select 1 from public.outlets where code=p_data->>'outlet_code' and active) then return jsonb_build_object('ok',false,'error','outlet'); end if;
 v_job:=coalesce(old_a.dispatch_job_id,nullif(p_data->>'dispatch_job_id','')::uuid);
 if v_job is not null then
   select * into j from public.website_dispatch_jobs where id=v_job for update;
   if j.id is null or j.kind<>v_kind or j.stage in ('picked','done','cancelled','merged') then return jsonb_build_object('ok',false,'error','closed'); end if;
   if old_a.id is null and exists(select 1 from public.ops_appointments where dispatch_job_id=v_job) then return jsonb_build_object('ok',false,'error','stale_version'); end if;
 end if;
 v_order:=coalesce(old_a.order_number,j.order_number,nullif(upper(p_data->>'order_number'),''));
 if v_kind in ('delivery','processing') or v_order is not null then
   select * into o from public.orders where order_number=v_order for update;
   if o.id is null or o.order_status in ('Cancelled','Delivered') then return jsonb_build_object('ok',false,'error','invalid_order'); end if;
   if v_kind='delivery' and o.order_status not in ('Ready','Out for Delivery') and v_day<=(now() at time zone 'Asia/Dhaka')::date then
     return jsonb_build_object('ok',false,'error','order_not_ready'); end if;
 end if;
 if v_kind='processing' and coalesce(p_data->>'processing_stage','') not in ('intake','washing','dry_cleaning','ironing','qc','packing') then return jsonb_build_object('ok',false,'error','invalid'); end if;
 v_phone:=public.website_dispatch_phone_key(coalesce(j.phone,o.phone_snapshot,p_data->>'phone'));
 select * into c from public.customers where phone=v_phone limit 1;
 if v_kind='pickup' and (coalesce(v_phone,'')!~'^01[3-9][0-9]{8}$' or length(btrim(coalesce(j.customer_name,p_data->>'name','')))<2
 or length(btrim(coalesce(j.address,p_data->>'address','')))<3 or nullif(btrim(coalesce(j.area,p_data->>'area','')),'') is null) then
 return jsonb_build_object('ok',false,'error','customer'); end if;
 if v_kind<>'processing' then
   select id into v_window from public.capacity_windows where active and (v_start at time zone 'Asia/Dhaka')::time>=starts_at and (v_end at time zone 'Asia/Dhaka')::time<=ends_at order by sort limit 1;
   if v_window is null then return jsonb_build_object('ok',false,'error','slot_closed'); end if;
   v_promised_date:=coalesce(old_a.promised_date,j.slot_date,nullif(p_data->>'promised_date','')::date,v_day);
   v_promised_window:=coalesce(old_a.promised_window,j.slot,nullif(p_data->>'promised_window',''),v_window);
   if (v_promised_date,v_promised_window) is distinct from (v_day,v_window) and v_reason is null then return jsonb_build_object('ok',false,'error','outside_customer_window'); end if;
 end if;
 -- Everything below is a subtransaction: any failure restores the old plan/reservation/task.
 begin
 if v_kind='pickup' and j.id is null then
   insert into public.tasks(title,type,priority,status,due_at,outlet_code,description,source,source_ref,dedupe_key,assigned_by_name)
   values(left('Pickup - '||(p_data->>'name'),200),'pickup','normal','open',v_end,p_data->>'outlet_code',
     concat_ws(E'\n','Name: '||(p_data->>'name'),'Phone: '||v_phone,'Address: '||(p_data->>'address'),'Area: '||(p_data->>'area'),'Notes: '||(p_data->>'notes')),
     'website_dispatch',v_phone,'scheduler:'||v_id::text,actor->>'name') returning id into v_task;
   insert into public.website_dispatch_jobs(kind,task_id,source,customer_name,phone,phone_key,address,area,outlet_code,stage,confirmed_at,confirmed_by)
   values('pickup',v_task,'website_booking',left(p_data->>'name',120),v_phone,v_phone,left(p_data->>'address',500),left(p_data->>'area',120),p_data->>'outlet_code','confirmed',now(),actor->>'name') returning * into j;
 elsif v_kind='delivery' and j.id is null then
   select * into j from public.website_dispatch_jobs where kind='delivery' and order_number=v_order and stage not in ('cancelled','merged') for update;
   if j.stage='done' then raise exception using errcode='P0001',message='closed'; end if;
   if j.id is null then
     insert into public.website_dispatch_jobs(kind,order_number,source,customer_name,phone,phone_key,address,area,outlet_code,stage)
     values('delivery',v_order,'ops_order',o.name_snapshot,o.phone_snapshot,v_phone,o.address_snapshot,o.zone_snapshot,o.outlet_code,'new') returning * into j;
   end if;
   if exists(select 1 from public.ops_appointments where dispatch_job_id=j.id and id<>v_id) then raise exception using errcode='P0001',message='stale_version'; end if;
 end if;
 -- Check the new exact interval before Dispatch mirrors reassignment. Otherwise a valid
 -- move could conflict at the old time with the new rider. This rolls back with the plan.
 if old_a.id is not null then
   update public.ops_appointments set scheduled_start=v_start,scheduled_end=v_end,assignee_id=v_assignee where id=v_id;
 end if;
 if v_kind<>'processing' then
   v_result:=public.website_dispatch_plan(j.id,v_assignee,v_name,v_day,v_window,actor->>'name',v_reason);
   if not coalesce((v_result->>'ok')::boolean,false) then raise exception using errcode='P0001',message=coalesce(v_result->>'error','unavailable'); end if;
 end if;
 insert into public.ops_appointments(id,kind,dispatch_job_id,order_number,customer_id,contact_name,phone_key,whatsapp,area,address,service,source,
 processing_stage,scheduled_start,scheduled_end,assignee_id,outlet_code,promised_date,promised_window,notes,blocking_reason,created_by,updated_by)
 values(v_id,v_kind,j.id,v_order,coalesce(o.customer_id,c.id),left(coalesce(j.customer_name,o.name_snapshot,p_data->>'name'),120),v_phone,left(p_data->>'whatsapp',32),
 left(coalesce(j.area,o.zone_snapshot,p_data->>'area'),120),left(coalesce(j.address,o.address_snapshot,p_data->>'address'),500),left(p_data->>'service',120),coalesce(p_data->>'source','manager'),
 case when v_kind='processing' then p_data->>'processing_stage' end,v_start,v_end,v_assignee,p_data->>'outlet_code',v_promised_date,v_promised_window,
 left(coalesce(p_data->>'notes',''),2000),left(coalesce(p_data->>'blocking_reason',''),300),p_actor,p_actor)
 on conflict(id) do update set scheduled_start=excluded.scheduled_start,scheduled_end=excluded.scheduled_end,assignee_id=excluded.assignee_id,
 outlet_code=excluded.outlet_code,notes=excluded.notes,blocking_reason=excluded.blocking_reason,processing_stage=excluded.processing_stage,service=excluded.service,
 whatsapp=excluded.whatsapp,customer_id=excluded.customer_id,updated_by=p_actor returning * into a;
 if j.id is not null then
   update public.tasks set due_at=v_start,reminded=false where id=(select task_id from public.website_dispatch_jobs where id=j.id) and status<>'done';
 end if;
 return jsonb_build_object('ok',true,'id',a.id,'version',a.version,'existing_customer',a.customer_id is not null);
 exception
 when exclusion_violation then return jsonb_build_object('ok',false,'error',case when v_kind='processing' then 'worker_conflict' else 'rider_conflict' end);
 when raise_exception then get stacked diagnostics v_error=message_text; return jsonb_build_object('ok',false,'error',v_error);
 when unique_violation then return jsonb_build_object('ok',false,'error','stale_version');
 end;
exception when invalid_text_representation or datetime_field_overflow or check_violation or not_null_violation then return jsonb_build_object('ok',false,'error','invalid');
 when deadlock_detected or serialization_failure then return jsonb_build_object('ok',false,'error','retry');
end $$;

create or replace function public.ops_scheduler_transition(p_actor uuid,p_id uuid,p_version integer,p_status text,p_reason text default null) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare actor jsonb:=public.ops_scheduler_actor(p_actor); a public.ops_appointments; r jsonb; o public.orders;
begin
 if actor is null then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 select * into a from public.ops_appointments where id=p_id for update;
 if a.id is null then return jsonb_build_object('ok',false,'error','not_found'); end if;
 if a.kind='processing' and actor->>'role'='support' then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 if a.version<>p_version then return jsonb_build_object('ok',false,'error','stale_version'); end if;
 if a.status in ('completed','cancelled') or p_status not in ('in_progress','completed','cancelled') then return jsonb_build_object('ok',false,'error','closed'); end if;
 if p_status='cancelled' and nullif(btrim(p_reason),'') is null then return jsonb_build_object('ok',false,'error','reason'); end if;
 if p_status in ('in_progress','completed') and a.assignee_id is null then return jsonb_build_object('ok',false,'error','needs_assignment'); end if;
 perform set_config('velto.scheduler_actor',p_actor::text,true); perform set_config('velto.scheduler_reason',coalesce(p_reason,''),true);
 if a.kind='delivery' and p_status in ('in_progress','completed') then
   select * into o from public.orders where order_number=a.order_number for update;
   if o.order_status not in ('Ready','Out for Delivery') then return jsonb_build_object('ok',false,'error','order_not_ready'); end if;
   if p_status='completed' then perform public.set_order_status(o.id,'Delivered','Scheduler: '||(actor->>'name')); end if;
 end if;
 if a.dispatch_job_id is not null and p_status in ('completed','cancelled') then
   r:=public.website_dispatch_close(a.dispatch_job_id,case when p_status='completed' then 'done' else 'cancelled' end,p_reason,actor->>'name');
   if not coalesce((r->>'ok')::boolean,false) then raise exception using errcode='P0001',message='closed'; end if;
 end if;
 update public.ops_appointments set status=p_status where id=p_id;
 return jsonb_build_object('ok',true);
exception when raise_exception then return jsonb_build_object('ok',false,'error','closed');
 when deadlock_detected or serialization_failure then return jsonb_build_object('ok',false,'error','retry');
end $$;

create or replace function public.ops_scheduler_board(p_actor uuid,p_day date) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare actor jsonb:=public.ops_scheduler_actor(p_actor); lo timestamptz:=p_day::timestamp at time zone 'Asia/Dhaka'; hi timestamptz:=(p_day+1)::timestamp at time zone 'Asia/Dhaka';
begin
 if actor is null then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 if p_day is null then return jsonb_build_object('ok',false,'error','invalid'); end if;
 perform public.website_dispatch_sync();
 perform public.capacity_sync_jobs();
 perform public.website_dispatch_autolink();
 return jsonb_build_object('ok',true,'loaded_at',clock_timestamp(),'config',(select to_jsonb(c)-'id' from public.ops_scheduler_config c where id),
 'appointments',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_start nulls last) from (
 select a.*,p.name assignee_name,o.order_status,o.due,o.delivery_date,j.slot_date,j.slot,j.requested
 from public.ops_appointments a left join public.profiles p on p.id=a.assignee_id left join public.orders o on o.order_number=a.order_number
 left join public.website_dispatch_jobs j on j.id=a.dispatch_job_id
 where (a.scheduled_start>=lo and a.scheduled_start<hi or a.scheduled_start is null and a.status in ('scheduled','in_progress')) and (a.kind<>'processing' or actor->>'role'<>'support')
 ) x),'[]'::jsonb),
 'unscheduled',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select j.id dispatch_job_id,j.kind,j.customer_name contact_name,j.phone_key,j.address,j.area,j.order_number,j.outlet_code,j.assignee_id,j.assignee_name,j.slot_date,j.slot,j.requested,j.source,j.stage,o.order_status,o.due,o.delivery_date
 from public.website_dispatch_jobs j left join public.orders o on o.order_number=j.order_number
 where j.stage in ('new','confirmed','assigned','scheduled') and j.source<>'website_quote'
 and not exists(select 1 from public.ops_appointments a where a.dispatch_job_id=j.id)
 and (j.slot_date is null or j.slot_date<=p_day) order by j.created_at limit 200
 ) x),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'can_ride',
 (not exists(select 1 from public.website_riders where can_ride) or coalesce(r.can_ride,false)),
 'off',exists(select 1 from public.website_rider_days_off d where d.profile_id=p.id and d.day=p_day)))
 from public.profiles p left join public.website_riders r on r.profile_id=p.id where p.active and p.role in ('admin','manager','worker','rider','ironman')),'[]'::jsonb),
 'outlets',(select jsonb_agg(jsonb_build_object('code',code,'name',name)) from public.outlets where active),
 'windows',(select jsonb_agg(jsonb_build_object('id',id,'starts',to_char(starts_at,'HH24:MI'),'ends',to_char(ends_at,'HH24:MI'),'active',active) order by sort) from public.capacity_windows),
 'can_process',actor->>'role' in ('owner','manager'));
end $$;


create or replace function public.ops_scheduler_search(p_actor uuid,p_query text) returns jsonb
language plpgsql stable set search_path=pg_catalog,public as $$
declare q text:=btrim(p_query); v_phone text:=public.website_dispatch_phone_key(p_query);
begin
 if public.ops_scheduler_actor(p_actor) is null then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 if length(q)<2 or length(q)>80 then return jsonb_build_object('ok',true,'customers','[]'::jsonb,'orders','[]'::jsonb); end if;
 return jsonb_build_object('ok',true,'customers',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select c.id,c.customer_code,c.name,c.phone,c.whatsapp,c.address,c.zone from public.customers c
 where c.phone=v_phone or position(lower(q) in lower(c.name))>0 or position(upper(q) in upper(c.customer_code))>0
 or (length(v_phone)>=4 and position(v_phone in c.phone)>0)
 order by (c.phone=v_phone) desc,c.name limit 8
 ) x),'[]'::jsonb),'orders',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select o.order_number,o.name_snapshot name,o.phone_snapshot phone,o.address_snapshot address,o.zone_snapshot zone,o.outlet_code,o.order_status,o.due,o.delivery_date
 from public.orders o where position(upper(q) in o.order_number)>0 or o.phone_snapshot=v_phone or position(lower(q) in lower(o.name_snapshot))>0
 order by o.created_at desc limit 8
 ) x),'[]'::jsonb));
end $$;


create or replace function public.ops_scheduler_settings(p_actor uuid,p_interval integer,p_start time,p_end time) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare actor jsonb:=public.ops_scheduler_actor(p_actor);
begin
 if actor is null or actor->>'role' not in ('owner','manager') then return jsonb_build_object('ok',false,'error','permission_denied'); end if;
 if p_interval is null or p_interval not in (15,30,60) or p_start is null or p_end is null or p_end<=p_start then return jsonb_build_object('ok',false,'error','invalid'); end if;
 update public.ops_scheduler_config set interval_minutes=p_interval,starts_at=p_start,ends_at=p_end where id;
 insert into public.website_admin_activity(actor_id,actor_name,actor_role,section,action,summary,detail)
 values(p_actor,actor->>'name',actor->>'role','dispatch','scheduler_settings','Updated scheduler working hours and interval',jsonb_build_object('interval',p_interval,'start',p_start,'end',p_end));
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.ops_scheduler_order_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.order_status in ('Cancelled','Delivered') and new.order_status is distinct from old.order_status then
 update public.ops_appointments set status=case when new.order_status='Delivered' and kind='delivery' then 'completed' else 'cancelled' end
 where order_number=new.order_number and status in ('scheduled','in_progress');
 end if;
 return null;
end $$;
drop trigger if exists ops_scheduler_order_changed on public.orders;
create trigger ops_scheduler_order_changed after update of order_status on public.orders for each row execute function public.ops_scheduler_order_changed();

alter table public.ops_appointments enable row level security;
alter table public.ops_scheduler_config enable row level security;
revoke all on public.ops_appointments,public.ops_scheduler_config from public,anon,authenticated;
grant select,insert,update on public.ops_appointments to service_role;
grant select,update on public.ops_scheduler_config to service_role;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'ops_scheduler_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
commit;
