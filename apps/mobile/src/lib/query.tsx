import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * Server-state cache. Travel data changes rarely and connectivity is poor on trains and in
 * hotels, so we keep data fresh for a minute, cached for a day, and retry gently.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60_000,
            retry: 2,
            refetchOnReconnect: true,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
