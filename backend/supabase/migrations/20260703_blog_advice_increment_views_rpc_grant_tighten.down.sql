-- Rollback: restore the prior grant state (anon + authenticated regain EXECUTE),
-- matching 20260703_blog_advice_increment_views_rpc.sql. No data impact.

grant execute on function public.increment_advice_views(text) to anon, authenticated;
