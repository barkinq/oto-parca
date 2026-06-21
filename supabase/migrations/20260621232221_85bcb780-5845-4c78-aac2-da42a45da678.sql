
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "parts_all_auth" ON public.parts;
DROP POLICY IF EXISTS "suppliers_all_auth" ON public.suppliers;
DROP POLICY IF EXISTS "po_all_auth" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_items_all_auth" ON public.purchase_order_items;
DROP POLICY IF EXISTS "customers_all_auth" ON public.customers;
DROP POLICY IF EXISTS "vehicles_all_auth" ON public.vehicles;
DROP POLICY IF EXISTS "sales_all_auth" ON public.sales;
DROP POLICY IF EXISTS "sale_items_all_auth" ON public.sale_items;
DROP POLICY IF EXISTS "auth read customer_transactions" ON public.customer_transactions;
DROP POLICY IF EXISTS "auth write customer_transactions" ON public.customer_transactions;
DROP POLICY IF EXISTS "auth update customer_transactions" ON public.customer_transactions;
DROP POLICY IF EXISTS "auth delete customer_transactions" ON public.customer_transactions;
DROP POLICY IF EXISTS "profiles_read_all_auth" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- PARTS
CREATE POLICY "parts_select_auth" ON public.parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "parts_insert_admin_depocu" ON public.parts FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "parts_update_admin_depocu" ON public.parts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "parts_delete_admin" ON public.parts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SUPPLIERS
CREATE POLICY "suppliers_select_auth" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_insert_admin_depocu" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "suppliers_update_admin_depocu" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "suppliers_delete_admin" ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PURCHASE ORDERS
CREATE POLICY "po_select_auth" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "po_insert_admin_depocu" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "po_update_admin_depocu" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "po_delete_admin" ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "po_items_select_auth" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "po_items_insert_admin_depocu" ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "po_items_update_admin_depocu" ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','depocu']::app_role[]));
CREATE POLICY "po_items_delete_admin" ON public.purchase_order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CUSTOMERS
CREATE POLICY "customers_select_auth" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_admin_kasiyer" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "customers_update_admin_kasiyer" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "customers_delete_admin" ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- VEHICLES
CREATE POLICY "vehicles_select_auth" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_insert_admin_kasiyer" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "vehicles_update_admin_kasiyer" ON public.vehicles FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "vehicles_delete_admin" ON public.vehicles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SALES
CREATE POLICY "sales_select_auth" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_insert_admin_kasiyer" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "sales_update_admin" ON public.sales FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sales_delete_admin" ON public.sales FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sale_items_select_auth" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sale_items_insert_admin_kasiyer" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "sale_items_update_admin" ON public.sale_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sale_items_delete_admin" ON public.sale_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CUSTOMER TRANSACTIONS
CREATE POLICY "ct_select_auth" ON public.customer_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct_insert_admin_kasiyer" ON public.customer_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','kasiyer']::app_role[]));
CREATE POLICY "ct_update_admin" ON public.customer_transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ct_delete_admin" ON public.customer_transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES (restrict PII)
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
