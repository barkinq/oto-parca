import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedBusinessId: string | null = null;

export function useBusinessId() {
  const [businessId, setBusinessId] = useState<string | null>(cachedBusinessId);

  useEffect(() => {
    if (cachedBusinessId) return;
    supabase.rpc("my_business_id").then(({ data }) => {
      if (data) {
        cachedBusinessId = data as string;
        setBusinessId(data as string);
      }
    });
  }, []);

  return businessId;
}

// Auth değişince cache'i sıfırla
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    cachedBusinessId = null;
  }
});
