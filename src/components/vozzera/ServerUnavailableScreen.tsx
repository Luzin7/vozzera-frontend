import { Button } from "@/components/ui/button";

export function ServerUnavailableScreen({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div role="alert" className="rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Não consegui falar com o servidor.
          </h2>
          <Button className="mt-5 w-full" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      </div>
    </div>
  );
}
