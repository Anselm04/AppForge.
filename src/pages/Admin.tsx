import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

export function Admin() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"analytics" | "codes" | "moderation">("analytics");
  const [grantType, setGrantType] = useState<"lifetime" | "limited">("limited");
  const [credits, setCredits] = useState("100");
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: me, isError, isLoading } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => trpc.admin.me.query(),
    retry: false,
  });
  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => trpc.admin.analytics.query(),
    enabled: !!me,
  });
  const { data: codes } = useQuery({
    queryKey: ["admin", "listCodes"],
    queryFn: () => trpc.admin.listCodes.query(),
    enabled: !!me && tab === "codes",
  });
  const { data: moderationQueue, refetch: refetchModeration } = useQuery({
    queryKey: ["admin", "moderationQueue"],
    queryFn: () => trpc.admin.moderationQueue.query(),
    enabled: !!me && tab === "moderation",
  });
  const reviewModeration = useMutation({
    mutationFn: (payload: { flagId: number; action: "dismiss" | "uphold" | "ban" }) =>
      trpc.admin.reviewModeration.mutate(payload),
    onSuccess: () => void refetchModeration(),
  });
  const createCode = useMutation({
    mutationFn: () => trpc.admin.createCode.mutate({
      grantType,
      credits: grantType === "limited" ? Math.max(1, parseInt(credits, 10) || 0) : undefined,
    }),
    onSuccess: (data) => {
      setMinted(data.code);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "listCodes"] });
    },
  });
  if (isError) return <div className="min-h-screen p-8"><h1 className="text-2xl font-bold text-red-600">Access Denied</h1></div>;
  if (isLoading || !me) return <div className="min-h-screen p-8">Loading...</div>;
  return <div className="min-h-screen p-8"><h1 className="text-3xl font-bold">AppForge Admin</h1><p>Signed in as {me.email}</p></div>;
}
