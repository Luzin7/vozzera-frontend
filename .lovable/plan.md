# Vozzera — Frontend MVP

Chat em tempo real (texto) sobre o backend Go descrito no contrato: login por cookie HttpOnly, lista de salas, histórico REST e mensagens ao vivo por WebSocket.

## Escopo do MVP

Entra:
- Tela de autenticação: login e registro (com invite code), com validação local de senha (mín. 6) e username (máx. 50).
- Tela principal: sidebar com salas de texto, criação de sala, área de mensagens com histórico + tempo real, caixa de envio.
- Salas de voz aparecem listadas mas desabilitadas ("em breve"), já com o slot pronto pro fluxo LiveKit.
- Reconnect do WebSocket com backoff e re-`join` automático das salas abertas.
- Botão "Sair" que apenas limpa o estado local (não existe rota de logout).

Não entra (não existe no backend): presença/online, typing, editar/apagar, upload, paginação, voz funcional, `/api/me`.

## Fluxo

```text
carrega app
  GET /api/rooms
    401 -> tela de login/registro
    200 -> tela principal + abre /ws
seleciona sala
  GET /api/rooms/{id}/messages?limit=50   (histórico)
  ws.send {type:"join", room_id}          (ao vivo)
enviar
  ws.send {type:"message", room_id, content}
  renderiza só quando o eco volta do servidor
```

## Regras que o front assume

- Todo `fetch` com `credentials: "include"`.
- Erros são `text/plain`: ler com `res.text()`, nunca `res.json()`.
- Identidade nunca é enviada pelo front; vem do servidor.
- Mensagem: `trim`, bloquear vazia, limitar a 2000 chars.
- Eventos WS: `switch` por `type`; campos zerados (`ZERO_UUID`, `0001-01-01...`) são ignorados.
- Sem otimismo na UI: a mensagem aparece quando o eco chega (sem `client_msg_id` para deduplicar).
- Nenhuma UI que sugira privacidade — qualquer logado lê e escreve em qualquer sala.

## Design

Interface escura tipo console de comunicação: sidebar estreita de salas, coluna central de mensagens agrupadas por autor, timestamps discretos, acento em um único tom vivo. Sem gradiente roxo genérico; tokens semânticos no `src/styles.css` (nada de `text-white`/`bg-black` hardcoded).

## Detalhes técnicos

- Rotas TanStack: `/` (chat, redireciona para `/auth` em 401) e `/auth`. `src/routes/index.tsx` (placeholder) vira o chat. `head()` próprio em cada rota.
- Base da API: `VITE_API_URL` (default `http://localhost:8080`), usada tanto no REST quanto no WS (`ws://` derivado). Em produção, servindo pelo Go na mesma origem, basta deixar vazio.
- Tudo client-side (`useEffect`/`useState` + TanStack Query nas leituras REST); nenhuma chamada no loader, pois o SSR não tem o cookie do usuário.
- Arquivos novos:
  - `src/lib/vozzera/types.ts` — tipos e helpers do §9 do contrato.
  - `src/lib/vozzera/api.ts` — wrapper `api()` com `credentials: "include"` e erro em texto.
  - `src/lib/vozzera/useSocket.ts` — hook de WebSocket: fila de envio antes do `open`, backoff, re-`join` das salas conhecidas, entrega de eventos por callback.
  - `src/lib/vozzera/useAuth.ts` — estado em memória + `username` em `localStorage` só para exibição.
  - `src/components/vozzera/` — `RoomSidebar`, `MessageList`, `MessageComposer`, `CreateRoomDialog`, `AuthForm`.
- Sem backend novo, sem Lovable Cloud: o servidor Go já é a fonte de verdade.

## Limitação conhecida

Rodando no preview da Lovable (domínio diferente do `localhost:8080`), o cookie `SameSite=Lax` do backend não será enviado cross-site — a autenticação só funciona rodando o front localmente contra o Go, ou com o build servido pelo próprio Go. O código já fica pronto para os dois casos.
