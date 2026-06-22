
CREATE OR REPLACE FUNCTION public.dec_part_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.parts SET stock = stock - NEW.qty WHERE id = NEW.part_id;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_sale_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  outstanding numeric;
BEGIN
  outstanding := COALESCE(NEW.total, 0) - COALESCE(NEW.paid_amount, 0);
  IF NEW.customer_id IS NOT NULL AND outstanding > 0 AND NEW.payment_type = 'veresiye' THEN
    UPDATE public.customers SET balance = COALESCE(balance, 0) + outstanding WHERE id = NEW.customer_id;
    INSERT INTO public.customer_transactions (customer_id, sale_id, type, amount, notes)
    VALUES (NEW.customer_id, NEW.id, 'borc', outstanding, 'Veresiye satış #' || NEW.sale_no);
  END IF;
  RETURN NEW;
END;
$function$;
