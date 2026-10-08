import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { Home } from "./Home.js";
import { LandingPage } from "./LandingPage.js";

/** Mount the private builder only after the server confirms this session. */
export function PublicHome() {
  const { data: me, isPending } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    retry: false,
  });
  if (isPending) return <p role="status">Loading AppForge…</p>;
  return me ? <Home /> : <LandingPage />;
}
