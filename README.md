# Vozzera — Frontend

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.x-FF4154?logo=tanstack)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Status](https://img.shields.io/badge/status-production-green)

Frontend do [Vozzera](https://github.com/Luzin7/vozzera) — servidor privado de chat e voz por convite. Construído com TanStack Start (SSR) + React 19 + Vite + shadcn/ui, consumindo o backend Go via REST + WebSocket.

## Funcionalidades

- **Autenticação** — login e registro com invite code; sessão em cookie HttpOnly.
- **Salas** — listagem e criação de salas de texto e voz (voz aparece listada, "em breve").
- **Mensagens de texto** — histórico via REST e mensagens ao vivo via WebSocket.
- **Reconexão** — WebSocket com backoff exponencial e re-`join` automático das salas abertas.

## Stack

| Camada     | Tecnologia                                                        |
| ---------- | ----------------------------------------------------------------- |
| Framework  | TanStack Start (SSR) + Vite                                       |
| UI         | React 19 + shadcn/ui + Tailwind CSS 4                             |
| Roteamento | TanStack Router (file-based)                                      |
| Dados      | `@tanstack/react-query` (infra pronta; leituras locais via hooks) |
| Validação  | zod                                                               |

## Pré-requisitos

- **Node.js 22+** e npm — [instale com nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
- **Backend Vozzera rodando** em `http://localhost:8080` (ver repo do backend).

## Quick start

```bash
npm i
npm run dev
```

Front em `http://localhost:3000`. Em dev, aponte pro backend Go via `VITE_API_URL` (default `http://localhost:8080`):

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

Em produção o build é servido pelo próprio Go na mesma origem — deixe `VITE_API_URL` vazio.

## Scripts

| Comando              | O que faz                                          |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Vite dev com HMR                                   |
| `npm run build`      | Build de produção (`vite build`)                   |
| `npm run preview`    | Prévia do build                                    |
| `npm run lint`       | ESLint                                             |
| `npm run typecheck`  | `tsc --noEmit`                                     |
| `npm test`           | Vitest (modo run)                                  |
| `npm run test:watch` | Vitest (watch)                                     |
| `npm run format`     | Prettier write                                     |
| `npm run check`      | Portão completo: lint + typecheck + testes + build |

## Estrutura de pastas

```
src/
  routes/                  # File-based routing (TanStack)
    index.tsx              # Home: chat completo
    __root.tsx             # Shell da app (não editar sem motivo)
  components/
    ui/                    # shadcn/ui — gerado, não editar à mão
    vozzera/               # Features do domínio (AuthForm, RoomSidebar, ...)
  lib/
    vozzera/               # Domínio: api, types, useAuth, useSocket, useChat
    utils.ts               # cn()
  server.ts / start.ts     # Entry SSR — boilerplate de deploy
  styles.css               # Design system (Tailwind)
```

## Documentação

- [`AGENTS.md`](./AGENTS.md) — **leia antes de qualquer mudança**; é o contrato para agentes de código/IA.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitetura e convenções do código.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — como contribuir, comandos e padrões.
- [`docs/CONTRATO-FRONTEND.md`](./docs/CONTRATO-FRONTEND.md) — contrato com o backend Go.

## Histórico

Não reescreva histórico publicado no `main` (force push, rebase/amend/squash de commits já empurrados) — o branch é a fonte de sincronização com o editor de origem deste projeto.
