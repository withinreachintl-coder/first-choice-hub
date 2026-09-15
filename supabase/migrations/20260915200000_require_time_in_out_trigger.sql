-- NOT APPLIED. Hold until owner signs off at merge.
-- Before applying, confirm every writer that closes work orders sends time_in/time_out.

create or replace function first_choice.require_time_in_out()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if lower(coalesce(new.status,'')) in ('closed','resolved')
     and lower(coalesce(old.status,'')) not in ('closed','resolved')
     and (new.time_in is null or new.time_out is null) then
    raise exception 'Time In and Time Out are required to close or resolve a work order';
  end if;
  return new;
end $$;

create trigger require_time_in_out
  before update on first_choice.work_orders
  for each row execute function first_choice.require_time_in_out();
