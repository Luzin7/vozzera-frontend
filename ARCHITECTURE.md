# Vozzera — Arquitetura & Convenções

## Stack

TanStack Start (SSR) sobre Vite + React 19 + TypeScript estrito. UI com shadcn/ui (Tailwind 4). Roteamento file-based do TanStack Router. Esse front é o cliente do backend Go do Vozzera — REST + WebSocket, contrato em [`docs/CONTRATO-FRONTEND.md`](./docs/CONTRATO-FRONTEND.md).

---

## Estrutura de Pastas

```
src/
  routes/                  # Rotas (TanStack file-based)
    index.tsx              # Home: composição do chat (thin, só apresentação)
    __root.tsx             # Shell (HeadContent, Outlet, providers) — boilerplate
  components/
    ui/                    # shadcn/ui (46 componentes) — NÃO editar à mão
    vozzera/               # Features do domínio (componentes "burros")
      AuthForm.tsx         # Login/registro
      CreateRoomDialog.tsx # Nova sala
      RoomSidebar.tsx      # Lista de salas + status do socket
      MessageList.tsx      # Histórico agrupado por autor
      MessageComposer.tsx  # Caixa de envio
  lib/
    vozzera/               # Domínio — tudo que não é React fica aqui
      types.ts             # Tipos do contrato + mappers fromHistory/fromEvent
      api.ts               # Cliente REST (api(), ApiError, wsUrl)
      chat.ts              # Lógica pura (appendMessage com dedup, backoffDelay)
      auth-errors.ts       # authErrorMessageFor: status → mensagem pt-BR
      useAuth.ts           # username em localStorage (só exibição)
      useSocket.ts         # WebSocket: fila, backoff, re-join
      useChat.ts           # Estado do chat: salas, mensagens, banner, socket
    utils.ts               # cn()
    error-*.ts             # Boilerplate de SSR/erro
  server.ts / start.ts     # Entry SSR — boilerplate de deploy
  styles.css               # Design system (tokens semânticos)
  router.tsx               # createRouter + QueryClient
```

### Regra central do domínio

`lib/vozzera/` guarda contrato, cliente HTTP/WS e hooks. `components/vozzera/` são apresentação pura: recebem props, não chamam API nem socket. `routes/index.tsx` só costura — estado e efeitos moram em `useChat`, a rota renderiza.

---

## Como o estado flui

1. **Auth** — `useAuth` guarda só o `username` em `localStorage` (exibição). A sessão real é o cookie HttpOnly do backend; `GET /api/me` fornece a identidade e a `role` atual.
2. **Bootstrap** — `useChat` carrega as salas e o usuário atual; `401` → tela de auth, `200` → aplica as permissões e abre o WebSocket.
3. **Socket** — `useSocket` conecta com backoff exponencial, fila envios antes do `open` e re-envia `join` de todas as salas conhecidas a cada reconexão.
4. **Mensagens** — chegam do histórico REST ou do WS; `appendMessage` (em `chat.ts`) faz dedup por `id`. Sem otimismo: a mensagem só aparece quando o eco volta.
5. **Salas** — `mod` e `admin` podem criar, renomear e apagar. Eventos `room:created`, `room:updated` e `room:deleted` mantêm todos os clientes sincronizados sem encerrar o WebSocket.

Nenhuma chamada roda em loader/SSR — o SSR não tem o cookie do usuário. Tudo é client-side.

---

## Convenções de código

Estas regras valem em todo arquivo deste repo:

- **Early return.** Caminho de erro sai primeiro; `else`/`else if` é exceção rara — se apareceu, extrai função.
- **Guard clause no topo** de handlers e funções com múltiplos casos.
- **Erro é tipo nomeado** — `ApiError` (com `status`) é o único erro de rede do domínio. Erros de formulário viram factory nomeada (`authErrorMessageFor`) no lugar de chain de `else if`.
- **Nome revela intenção** — `appendMessage`, `backoffDelay`, `authErrorMessageFor`. Papel vira sufixo.
- **Identificador em inglês; mensagem ao usuário em pt-BR.**
- **Import por path alias `@/`** — nunca `../../..`.
- **Comentário é exceção.** Se precisa explicar, o nome está errado.
- **Teto de complexidade por função** — mais de 3–5 `if` numa função é sinal de extração.
- **Teste ao lado do código** — `X.spec.ts` junto de `X.ts`, testando lógica pura sem setup elaborado.

## O que NÃO editar

- **`src/components/ui/`** — gerado pelo shadcn. Mudar é com `npx shadcn add`.
- **`src/routeTree.gen.ts`** — gerado pelo plugin de rotas.
- **`src/server.ts`, `src/start.ts`, `src/lib/error-*.ts`** — boilerplate de SSR e captura de erro. Mexer só se for resolver um problema real desses arquivos.
- **`src/styles.css`** — design system; novos tokens seguem o padrão `oklch` já documentado no arquivo.

---

## Produção

- Build servido pelo **próprio Go na mesma origem** — `VITE_API_URL` vazio.
- Cookie `SameSite=Lax` + `credentials: "include"`: o front precisa estar na mesma origem do backend (ou o cookie não chega cross-site).
- Rede de erro de formulário em pt-BR, identificadores em inglês.

Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) para comandos e checklist de PR.
