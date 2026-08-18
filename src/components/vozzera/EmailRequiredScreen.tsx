import { EmailChangeForm } from "./EmailChangeForm";

type Props = {
  onUpdateEmail: (email: string) => Promise<string>;
  onLogout: () => void;
};

export function EmailRequiredScreen({ onUpdateEmail, onLogout }: Readonly<Props>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Cadastre seu email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua conta ainda não tem um email cadastrado. Cadastre um para recuperar a senha se
            precisar e continuar usando o Vozzera.
          </p>
          <div className="mt-5">
            <EmailChangeForm onSubmit={onUpdateEmail} />
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
