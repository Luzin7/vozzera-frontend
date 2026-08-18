import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/vozzera/api";
import { authErrorMessageFor } from "@/lib/vozzera/auth-errors";
import { MIN_PASSWORD_LENGTH } from "@/lib/vozzera/types";

export function ResetPasswordPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const goToLogin = () => void navigate({ to: "/" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(authErrorMessageFor(err, "reset"));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <ResetShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Link inválido ou expirado. Peça um novo link de redefinição.
          </p>
          <Button className="w-full" onClick={goToLogin}>
            Ir para o login
          </Button>
        </div>
      </ResetShell>
    );
  }

  if (done) {
    return (
      <ResetShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">Senha redefinida. Entre com a nova senha.</p>
          <Button className="w-full" onClick={goToLogin}>
            Ir para o login
          </Button>
        </div>
      </ResetShell>
    );
  }

  return (
    <ResetShell>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Redefinir senha</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha uma nova senha para a sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Salvando..." : "Redefinir senha"}
          </Button>
        </form>
      </div>
    </ResetShell>
  );
}

function ResetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 font-mono text-lg font-bold text-primary">
            VZ
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vozzera</h1>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">{children}</div>
      </div>
    </div>
  );
}
