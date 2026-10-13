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
      RoomSidebar.tsx      # Lista de salas (texto/voz) + status do socket
      RoomSettingsView.tsx # Configurações da sala (nome, visibilidade, apagar)
      VoiceChatDock.tsx    # Chat da call de voz (dock lateral)
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
5. **Salas** — `mod` e `admin` podem criar, renomear e apagar. Uma sala sempre tem chat de texto; `has_voice` (imutável) adiciona a capacidade de call, e `staff_only` restringe visibilidade/acesso à moderação. Eventos `room.created`, `room.updated` e `room.deleted` mantêm todos os clientes sincronizados sem encerrar o WebSocket; virar `staff_only` derruba as assinaturas ativas da sala.

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

- Front na Vercel (`vozzera.vercel.app`), API no Render; `VITE_API_URL` aponta pra API.
- Cookie `SameSite=None; Secure; Partitioned` + `credentials: "include"`: front e API estão em sites diferentes; detalhes e limitações em [`docs/CONTRATO-FRONTEND.md`](./docs/CONTRATO-FRONTEND.md).
- Rede de erro de formulário em pt-BR, identificadores em inglês.

## PWA

- `public/manifest.webmanifest`: app instalável em janela própria, com barra de título própria opcional (Window Controls Overlay, `TitleBar.tsx`) e instância única (`launch_handler: focus-existing`). Link aberto com o app já aberto chega pelo `launchQueue` em `use-pwa-runtime.ts`.
- `public/sw.js`: guarda só os arquivos do app. `/assets/*` é cache-first (nome com hash) e navegação é network-first, com `/` de reserva offline. Nunca intercepta outra origem (a API) nem guarda URL com query. Registrado só no build de produção.
- Ícones em `public/icons/`, gerados dos SVGs do Papo (rosto de 32px pra cima, glifo em 16 e 24px) sobre `--background`.
- O que muda a experiência é opção da pessoa: instalar e contador de não lidas no ícone ficam em Configurações › App; a mini janela de voz (Document Picture-in-Picture) só abre pelo botão na chamada.

Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) para comandos e checklist de PR.
