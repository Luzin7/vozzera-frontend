import { describe, expect, it } from "vitest";

import { ApiUrlError, resolveApiBaseUrl, wsUrlFrom } from "@/lib/vozzera/api-url";

describe("resolveApiBaseUrl", () => {
  it("usa localhost em dev quando a variavel nao existe", () => {
    expect(resolveApiBaseUrl({ isProduction: false })).toBe("http://localhost:8080");
  });

  it("usa localhost em dev quando a variavel esta vazia", () => {
    expect(resolveApiBaseUrl({ isProduction: false, value: "  " })).toBe("http://localhost:8080");
  });

  it("falha em producao sem a variavel", () => {
    expect(() => resolveApiBaseUrl({ isProduction: true })).toThrow(ApiUrlError);
  });

  it("falha em producao com a variavel vazia", () => {
    expect(() => resolveApiBaseUrl({ isProduction: true, value: "" })).toThrow(ApiUrlError);
  });

  it("remove a barra final", () => {
    expect(resolveApiBaseUrl({ isProduction: true, value: "https://vozzera.onrender.com/" })).toBe(
      "https://vozzera.onrender.com",
    );
  });

  it("rejeita http em producao", () => {
    expect(() =>
      resolveApiBaseUrl({ isProduction: true, value: "http://vozzera.onrender.com" }),
    ).toThrow(ApiUrlError);
  });

  it("rejeita url relativa em producao", () => {
    expect(() => resolveApiBaseUrl({ isProduction: true, value: "/api" })).toThrow(ApiUrlError);
  });

  it("aceita http em dev", () => {
    expect(resolveApiBaseUrl({ isProduction: false, value: "http://192.168.0.5:8080/" })).toBe(
      "http://192.168.0.5:8080",
    );
  });
});

describe("wsUrlFrom", () => {
  it("deriva wss de https", () => {
    expect(wsUrlFrom("https://vozzera.onrender.com")).toBe("wss://vozzera.onrender.com");
  });

  it("deriva ws de http", () => {
    expect(wsUrlFrom("http://localhost:8080")).toBe("ws://localhost:8080");
  });
});
