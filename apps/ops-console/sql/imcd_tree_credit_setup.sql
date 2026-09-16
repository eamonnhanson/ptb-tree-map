-- Run only after the inspection script has confirmed the users1 column names
-- and exactly one match for each approved email. Target: defaultdb.
BEGIN;

create table if not exists public.ops_console_tree_credits (
  customer_code text primary key,
  starts_at timestamptz not null,
  opening_trees integer not null check (opening_trees >= 0),
  alert_threshold integer not null check (alert_threshold >= 0),
  account_manager text not null
);
create table if not exists public.ops_console_tree_credit_accounts (
  credit_code text not null references public.ops_console_tree_credits(customer_code),
  user_id bigint not null references public.users1(id),
  region text not null check (region in ('NL', 'BE')),
  primary key (credit_code, user_id), unique (credit_code, region, user_id)
);
create table if not exists public.ops_console_tree_credit_topups (
  id bigint generated always as identity primary key,
  credit_code text not null references public.ops_console_tree_credits(customer_code),
  reference text not null,
  trees integer not null check (trees > 0),
  ordered_at date,
  received_at date,
  notes text,
  unique (credit_code, reference)
);

insert into public.ops_console_tree_credits (customer_code, starts_at, opening_trees, alert_threshold, account_manager)
values ('imcd_benelux', '2026-09-10 00:00:00 Europe/Amsterdam'::timestamptz, 25, 5, 'Eamonn Hanson')
on conflict (customer_code) do nothing;

do $$
declare matched integer;
begin
  select count(*) into matched from public.users1 where lower(email) = 'joke.deschoenmaeker@imcd.be';
  if matched <> 1 then raise exception 'IMCD setup stopped: expected one match for approved BE account, found %', matched; end if;
  select count(*) into matched from public.users1 where lower(email) = 'receptie.rotterdam@imcd.nl';
  if matched <> 1 then raise exception 'IMCD setup stopped: expected one match for approved NL account, found %', matched; end if;
  select count(*) into matched from public.users1 where lower(email) = 'sylvia.denotter@imcd.nl';
  if matched <> 1 then raise exception 'IMCD setup stopped: expected one match for approved NL account, found %', matched; end if;
end $$;

insert into public.ops_console_tree_credit_accounts (credit_code, user_id, region)
select 'imcd_benelux', id, case when lower(email) = 'joke.deschoenmaeker@imcd.be' then 'BE' else 'NL' end
from public.users1
where lower(email) in ('joke.deschoenmaeker@imcd.be', 'receptie.rotterdam@imcd.nl', 'sylvia.denotter@imcd.nl')
on conflict (credit_code, user_id) do nothing;

COMMIT;
