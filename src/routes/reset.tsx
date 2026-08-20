import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

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

  useEffect(() => {
    if (window.location.search === "") return;
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return <ResetPasswordPage token={token} />;
}
