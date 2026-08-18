const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registrationEmailErrorFor(email: string): string | null {
  const clean = email.trim();
  if (!clean) return "Informe seu email.";
  if (!EMAIL_PATTERN.test(clean)) return "Informe um email válido.";
  return null;
}
