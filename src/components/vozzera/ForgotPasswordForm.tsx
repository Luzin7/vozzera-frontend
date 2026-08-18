import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/vozzera/api";
import { authErrorMessageFor } from "@/lib/vozzera/auth-errors";
import { registrationEmailErrorFor } from "@/lib/vozzera/auth-validation";

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailProblem = registrationEmailErrorFor(email);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(authErrorMessageFor(err, "forgot"));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Se o email existir, você receberá um link para redefinir a senha.
        </p>
        <Button variant="outline" className="w-full" onClick={onBack}>
          Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Esqueci minha senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu email e enviaremos um link de redefinição.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Enviando..." : "Enviar link"}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Voltar para o login
      </button>
    </div>
  );
}
