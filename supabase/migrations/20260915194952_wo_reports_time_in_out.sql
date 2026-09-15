alter table first_choice.work_orders
  add column if not exists time_in timestamptz,
  add column if not exists time_out timestamptz;

alter table first_choice.work_orders
  add constraint work_orders_time_order_chk
  check (time_in is null or time_out is null or time_out > time_in);

create or replace view first_choice.v_open_wo_report with (security_invoker = true) as
select work_order_id, location_group, location_sub, location,
  (submitted_at at time zone 'America/Chicago')::date as date_opened,
  (now() at time zone 'America/Chicago')::date
    - (submitted_at at time zone 'America/Chicago')::date as days_open,
  priority, category
from first_choice.work_orders
where lower(status) = 'open';

create or replace view first_choice.v_closed_wo_report with (security_invoker = true) as
select work_order_id, status, location_group, location_sub, location,
  (submitted_at at time zone 'America/Chicago')::date as date_opened,
  (closed_at at time zone 'America/Chicago')::date as date_closed,
  time_in, time_out,
  round((extract(epoch from (time_out - time_in)) / 3600.0)::numeric, 2) as hours,
  tech_name, cost_amount
from first_choice.work_orders
where lower(status) in ('closed','resolved');
