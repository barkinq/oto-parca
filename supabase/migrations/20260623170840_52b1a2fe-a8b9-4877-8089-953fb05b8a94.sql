-- Recreate helper with explicit schema and security-definer access.
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Keep sale ownership populated for new rows without requiring the client to send it.
ALTER TABLE public.sales ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Ensure API grants and sequence access are present.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;
GRANT ALL ON public.sales TO service_role;
GRANT ALL ON public.sale_items TO service_role;
GRANT ALL ON public.parts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sales_sale_no_seq TO authenticated;
GRANT ALL ON SEQUENCE public.sales_sale_no_seq TO service_role;

-- Remove every existing policy on the three tables so the rewrite is clean.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('sales', 'sale_items', 'parts')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

-- SALES: simple role-based policies.
CREATE POLICY "sales_select_authenticated"
ON public.sales
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "sales_insert_admin_kasiyer_simple"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'kasiyer']::public.app_role[])
);

CREATE POLICY "sales_update_admin_only"
ON public.sales
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "sales_delete_admin_only"
ON public.sales
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- SALE ITEMS: simple role-based policies.
CREATE POLICY "sale_items_select_authenticated"
ON public.sale_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "sale_items_insert_admin_kasiyer_simple"
ON public.sale_items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'kasiyer']::public.app_role[])
);

CREATE POLICY "sale_items_update_admin_only"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "sale_items_delete_admin_only"
ON public.sale_items
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- PARTS: simple role-based policies. Kasiyer can update stock during sales; depocu can manage stock/product data.
CREATE POLICY "parts_select_authenticated"
ON public.parts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "parts_insert_admin_depocu"
ON public.parts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'depocu']::public.app_role[])
);

CREATE POLICY "parts_update_admin_depocu_kasiyer_simple"
ON public.parts
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'depocu', 'kasiyer']::public.app_role[])
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.has_any_role(auth.uid(), ARRAY['admin', 'depocu', 'kasiyer']::public.app_role[])
);

CREATE POLICY "parts_delete_admin_only"
ON public.parts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Restore stock decrement trigger with elevated privileges so sale item inserts can update stock reliably.
CREATE OR REPLACE FUNCTION public.dec_part_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.parts
  SET stock = stock - NEW.qty,
      updated_at = now()
  WHERE id = NEW.part_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_items_dec_stock ON public.sale_items;
CREATE TRIGGER sale_items_dec_stock
AFTER INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.dec_part_stock();

-- Restore credit-sale balance trigger with elevated privileges.
CREATE OR REPLACE FUNCTION public.handle_sale_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  outstanding numeric;
BEGIN
  outstanding := COALESCE(NEW.total, 0) - COALESCE(NEW.paid_amount, 0);
  IF NEW.customer_id IS NOT NULL AND outstanding > 0 AND NEW.payment_type = 'veresiye' THEN
    UPDATE public.customers
    SET balance = COALESCE(balance, 0) + outstanding,
        updated_at = now()
    WHERE id = NEW.customer_id;

    INSERT INTO public.customer_transactions (customer_id, sale_id, type, amount, notes)
    VALUES (NEW.customer_id, NEW.id, 'borc', outstanding, 'Veresiye satış #' || NEW.sale_no);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_sale_balance ON public.sales;
CREATE TRIGGER trg_handle_sale_balance
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_balance();