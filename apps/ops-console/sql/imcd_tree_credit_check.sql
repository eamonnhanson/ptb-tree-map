-- Read-only control query. claimed_at is compared to the explicit Amsterdam start instant.
with credit as (select * from public.ops_console_tree_credits where customer_code = 'imcd_benelux'), usage as (
 select a.region, a.user_id, count(t.id)::bigint as trees from public.ops_console_tree_credit_accounts a join credit c on c.customer_code=a.credit_code left join public.trees1 t on t.user_id=a.user_id and t.claimed_at >= c.starts_at where a.credit_code='imcd_benelux' group by a.region,a.user_id
), topups as (select coalesce(sum(trees),0)::bigint trees from public.ops_console_tree_credit_topups where credit_code='imcd_benelux')
select c.starts_at, c.opening_trees, (select trees from topups) as additions, u.region, u.user_id, u.trees as consumption, c.opening_trees+(select trees from topups)-(select coalesce(sum(trees),0) from usage) as remaining
from credit c cross join usage u order by u.region, u.user_id;
