import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ResetPasswordPage } from "@/components/vozzera/ResetPasswordPage";

const title = "Redefinir senha — Vozzera";

export const Route = createFileRoute("/reset")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [{ title }],
  }),
  component: ResetRoute,
});

function ResetRoute() {
  const { token } = Route.useSearch();
  const resetToken = useTokenTakenFromUrl(token);

  return <ResetPasswordPage token={resetToken} />;
}

function useTokenTakenFromUrl(tokenFromUrl: string): string {
  const [token] = useState(tokenFromUrl);

  useEffect(() => {
    if (window.location.search === "") return;
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return token;
}
