import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessageFor } from "@/lib/vozzera/auth-errors";
import { registrationEmailErrorFor } from "@/lib/vozzera/auth-validation";

const MAX_EMAIL_LENGTH = 254;

type Props = {
  onSubmit: (email: string) => Promise<string>;
};

export function EmailChangeForm({ onSubmit }: Readonly<Props>) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
      await onSubmit(email.trim());
      setSaved(true);
      setEmail("");
    } catch (err) {
      setError(authErrorMessageFor(err, "email"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          maxLength={MAX_EMAIL_LENGTH}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {saved && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Email atualizado.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Salvando..." : "Salvar email"}
      </Button>
    </form>
  );
}
