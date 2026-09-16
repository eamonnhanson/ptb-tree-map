-- Review-only. Run this in Beekeeper against defaultdb before any setup.
-- Do not copy result rows containing email addresses into tickets or logs.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('users1', 'trees1')
order by table_name, ordinal_position;

select id, email
from public.users1
where lower(email) in ('joke.deschoenmaeker@imcd.be', 'receptie.rotterdam@imcd.nl', 'sylvia.denotter@imcd.nl')
order by lower(email), id;

-- Expected: exactly one row per supplied email. Stop on zero or multiple rows.
select lower(email) as email, count(*) as matches, array_agg(id order by id) as user_ids
from public.users1
where lower(email) in ('joke.deschoenmaeker@imcd.be', 'receptie.rotterdam@imcd.nl', 'sylvia.denotter@imcd.nl')
group by lower(email)
order by email;
