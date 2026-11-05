const DEV_API_BASE_URL = "http://localhost:8080";

export class ApiUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiUrlError";
  }
}

type ApiUrlInput = {
  isProduction: boolean;
  value?: string | undefined;
};

function isAbsoluteUrl(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl({ isProduction, value }: ApiUrlInput): string {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    if (isProduction) {
      throw new ApiUrlError("VITE_API_URL é obrigatória no build de produção.");
    }
    return DEV_API_BASE_URL;
  }

  const allowedProtocols = isProduction ? ["https:"] : ["https:", "http:"];
  if (!isAbsoluteUrl(trimmed, allowedProtocols)) {
    throw new ApiUrlError(
      `VITE_API_URL inválida: "${trimmed}". Use uma URL absoluta ${isProduction ? "https" : "http(s)"}.`,
    );
  }

  return trimmed.replace(/\/+$/, "");
}

export function wsUrlFrom(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/^http/, "ws");
}
