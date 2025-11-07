// lib/payments/useJazzCashHosted.ts
import { useState, useCallback } from "react";
import {
  JazzCashInitRequest,
  payWithJazzcashHosted,
} from "./hosted";

export function useJazzCashHosted(initUrl?: string) {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const pay = useCallback(
    async (req: JazzCashInitRequest) => {
      setLoading(true);
      setError(null);
      try {
        await payWithJazzcashHosted(req, {
          initUrl,
          onBeforeRedirect: () => {/* e.g., close cart drawer */},
        });
      } catch (e) {
        setError(e);
        setLoading(false); // only stays if failed before redirect
        throw e;
      }
    },
    [initUrl]
  );

  return { pay, isLoading, error };
}
