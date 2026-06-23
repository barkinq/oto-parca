REVOKE ALL ON FUNCTION public.dec_part_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_sale_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dec_part_stock() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_sale_balance() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;