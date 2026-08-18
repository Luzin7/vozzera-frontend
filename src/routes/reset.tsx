import { createFileRoute } from "@tanstack/react-router";

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
  return <ResetPasswordPage token={token} />;
}
