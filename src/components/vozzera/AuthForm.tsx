import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register } from "@/lib/vozzera/api";
import { authErrorMessageFor } from "@/lib/vozzera/auth-errors";
import { registrationEmailErrorFor } from "@/lib/vozzera/auth-validation";
import { MAX_USERNAME_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/vozzera/types";

type Mode = "login" | "register";

export function AuthForm({ onAuthenticated }: { onAuthenticated: (username: string) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const name = username.trim();
    if (!name) return "Escolha um nome de usuário.";
    if (name.length > MAX_USERNAME_LENGTH)
      return `Nome de usuário deve ter no máximo ${MAX_USERNAME_LENGTH} caracteres.`;
    if (password.length < MIN_PASSWORD_LENGTH)
      return `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    if (mode === "register") {
      const emailProblem = registrationEmailErrorFor(email);
      if (emailProblem) return emailProblem;
    }
    if (mode === "register" && !inviteCode.trim()) return "Informe o código de convite.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    const name = username.trim();

    try {
      if (mode === "register") {
        await register(name, password, email.trim(), inviteCode.trim());
      }
      const session = await login(name, password);
      onAuthenticated(session.username);
    } catch (err) {
      setError(authErrorMessageFor(err, mode));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 font-mono text-lg font-bold text-primary">
            VZ
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vozzera</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Servidor privado de texto e voz. Só pra quem tem convite.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                name="username"
                value={username}
                maxLength={MAX_USERNAME_LENGTH}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="invite">Código de convite</Label>
                <Input
                  id="invite"
                  name="inviteCode"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                />
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta e entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
