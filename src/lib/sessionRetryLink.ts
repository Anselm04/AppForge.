import { TRPCClientError, type TRPCLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { observable, type Unsubscribable } from "@trpc/server/observable";
import { refreshSession } from "./auth.js";

/** Recover a denied read even when its batch has HTTP 207. Never replay writes. */
export function sessionRetryLink<
  TRouter extends AnyRouter,
>(): TRPCLink<TRouter> {
  return () =>
    ({ op, next }) =>
      observable((observer) => {
        let subscription: Unsubscribable | undefined;
        let cancelled = false;
        let retried = false;
        const attempt = () => {
          if (cancelled || op.signal?.aborted) return;
          subscription = next(op).subscribe({
            next: (value) => observer.next(value),
            complete: () => observer.complete(),
            error: (error) => {
              if (
                op.type !== "query" ||
                retried ||
                error.data?.code !== "UNAUTHORIZED"
              ) {
                observer.error(error);
                return;
              }
              retried = true;
              void refreshSession().then(
                (session) => {
                  if (cancelled || op.signal?.aborted) return;
                  if (session) attempt();
                  else observer.error(error);
                },
                () => {
                  if (!cancelled) observer.error(error);
                },
              );
            },
          });
        };
        const abort = () => {
          cancelled = true;
          subscription?.unsubscribe();
          observer.error(TRPCClientError.from(new Error("Request aborted")));
        };
        op.signal?.addEventListener("abort", abort, { once: true });
        if (op.signal?.aborted) abort();
        else attempt();
        return () => {
          op.signal?.removeEventListener("abort", abort);
          cancelled = true;
          subscription?.unsubscribe();
        };
      });
}
