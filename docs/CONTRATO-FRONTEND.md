# Contrato Frontend ↔ Backend Vozzera

Contrato que o front assume sobre o backend Go. Versão atualizada a partir do código real em `src/lib/vozzera/` (o plano original do projeto está desatualizado). Backend: `https://github.com/Luzin7/vozzera`.

## Regras globais

- Todo `fetch` com `credentials: "include"` (sessão por cookie HttpOnly).
- Erros HTTP são `text/plain` — ler com `res.text()`, **nunca** `res.json()`.
- Identidade nunca é enviada pelo front; vem do servidor nas respostas.
- A identidade e a permissão atuais vêm de `GET /api/me`; o `username` no `localStorage` serve apenas para exibição e não é credencial.
- `POST /api/logout` encerra a sessão no servidor (204). Best-effort: o front limpa o estado local mesmo se a rota falhar.
- **Sessão morreu** = qualquer `401` em rota autenticada ou o servidor fechar o WebSocket com `code 1005` (revogação/expiração). O front desloga sozinho e volta pro login — sem retry infinito do WS.
- Base da API: `VITE_API_URL` (default `http://localhost:8080`). Em produção o build é servido pelo Go na mesma origem — deixar vazio. WebSocket deriva da mesma base.

## REST

### `POST /api/login`

```jsonc
// request
{ "username": "string", "password": "string" }
// response 200
{ "message": "string", "id": "string", "username": "string" }
```

- `username` aceita **usuário ou email** (até 254 caracteres).
- `401` → credenciais inválidas.

### `POST /api/register`

```jsonc
// request
{ "username": "string", "password": "string", "email": "string", "invite_code": "string" }
// response 201
{ "message": "string", "id": "string" }
```

- `400` → payload ou email inválido.
- `403` → invite code inválido.
- `409` → username já em uso.
- Não loga: o front sempre faz `login` em seguida.

### `POST /api/forgot-password`

```jsonc
// request
{ "email": "string" }
// response 200
{ "message": "string" }
```

- Sem autenticação. Resposta é **sempre 200** quando o email é válido, cadastrado ou não — não vaza quais contas existem. `400` apenas para email inválido.
- Front: o link "Esqueci minha senha?" na tela de login abre o formulário de email; no sucesso exibe sempre a mensagem genérica ("se o email existir, você receberá um link"), nunca confirma a existência da conta.

### `POST /api/reset-password`

```jsonc
// request
{ "token": "string", "password": "string" }
// response 200
{ "message": "string" }
```

- Sem autenticação. Token é de uso único e expira após `PASSWORD_RESET_TTL`; redefinir revoga todas as sessões do usuário.
- `400` → token inválido/expirado ou senha fora de 8–72 caracteres.
- Front: rota `/reset?token=...` (link do email) mostra o formulário de nova senha + confirmação; no sucesso volta pro login.

### `GET /api/rooms`

```jsonc
// response 200
[
  { "id": "string", "name": "string", "type": "text" | "voice", "created_at": "string" }
]
```

- `401` → não autenticado (front mostra a tela de login).

### `GET /api/me`

```jsonc
// response 200
{ "id": "string", "username": "string", "role": "user" | "mod" | "admin", "email": "string" }
```

- `role` controla as ações administrativas da UI; apenas `mod` e `admin` podem criar, editar ou apagar salas.
- `email` termina em `@legacy.local` quando a conta é legada e ainda não tem email real — o front bloqueia o app até cadastrar um (tela pós-login).

### `PATCH /api/me`

```jsonc
// request
{ "email": "string" }
// response 200
{ "message": "string", "email": "string" }
```

- Troca o email da conta autenticada. Usado pela tela bloqueante de email legado e pelas configurações.
- `400` → email inválido. `409` → email já em uso por outra conta.

### `POST /api/rooms`

```jsonc
// request
{ "name": "string", "type": "text" | "voice" }
// response 201
{ "id": "string", "name": "string", "type": "text" | "voice", "created_at": "string", "updated_at": "string" | null }
```

- Requer `role` `mod` ou `admin`; `403` para usuários sem permissão.

### `PATCH /api/rooms/{id}`

```jsonc
// request
{ "name": "string" }
// response 200
{ "id": "string", "name": "string", "type": "text" | "voice", "created_at": "string", "updated_at": "string" | null }
```

- Requer `role` `mod` ou `admin`.
- `400` para nome inválido, `403` sem permissão e `404` se a sala não existe.

### `DELETE /api/rooms/{id}`

Remove uma sala. O front trata qualquer 2xx como sucesso (204 esperado) e limpa a sala do estado local.

- Requer `role` `mod` ou `admin`.
- `403` sem permissão e `404` se a sala não existe.

### `POST /api/voice/token`

```jsonc
// request
{ "room_id": "string" }
// response 200
{ "token": "string", "url": "string", "room_name": "string" }
```

- `token` é o JWT do LiveKit; `url` é o `wss://` do projeto; `room_name` só pra exibir (a sala real é o UUID, já embutido no token).

#### Áudio no compartilhamento de tela

O frontend passa `audio: true` ao LiveKit. Isso solicita a captura de áudio ao `getDisplayMedia`, mas o navegador decide se oferece o checkbox de áudio e qual fonte pode ser capturada.

| Ambiente           | Aba                | Janela             | Tela inteira       | Validação          |
| ------------------ | ------------------ | ------------------ | ------------------ | ------------------ |
| Chrome no Windows  | Áudio com opt-in   | Áudio com opt-in   | Áudio com opt-in   | Manual, confirmado |
| Edge no Windows    | Áudio com opt-in   | Áudio com opt-in   | Áudio com opt-in   | Manual, confirmado |
| ChromeOS           | Áudio esperado     | Sem áudio esperado | Áudio esperado     | Pendente           |
| Chrome macOS/Linux | Áudio esperado     | Sem áudio esperado | Sem áudio esperado | Pendente           |
| Firefox            | Sem áudio esperado | Sem áudio esperado | Sem áudio esperado | Pendente           |

- O receptor anexa e reproduz qualquer trilha `Track.Kind.Audio`, incluindo `Track.Source.ScreenShareAudio`.
- A UI não adiciona orientação própria por plataforma. O seletor nativo informa se o áudio está disponível e mantém a decisão com o usuário.
- Parar o compartilhamento pelo LiveKit encerra as trilhas de vídeo e áudio da tela.
- A validação no Windows foi feita com outro participante recebendo o áudio nas três superfícies.

### `GET /api/rooms/{id}/messages?limit=50`

```jsonc
// response 200 — atenção: NÃO tem room_id
[
  {
    "id": "string",
    "content": "string",
    "created_at": "string",
    "user_id": "string",
    "username": "string",
  },
]
```

## WebSocket

Endpoint `/ws`, mesma base da API (http→ws, https→wss).

### Inbound (front → server)

```jsonc
{ "type": "join", "room_id": "string" }
{ "type": "message", "room_id": "string", "content": "string" }
```

### Outbound (server → front)

```jsonc
{
  "type": "message" | "presence" | "room" | "error",
  "id": "string",          // sempre presente; ZERO_UUID quando não se aplica
  "room_id": "string",     // idem
  "user_id": "string",     // idem
  "created_at": "string",  // idem ("0001-01-01T00:00:00Z")
  "username": "string",    // opcional
  "content": "string",     // opcional
  "error": "string"        // opcional
}
```

Eventos de sala:

```jsonc
{ "type": "room", "action": "created" | "updated", "id": "string", "name": "string", "room_type": "text" | "voice" }
{ "type": "room", "action": "deleted", "id": "string" }
```

Regras:

- Campos zerados (`ZERO_UUID = 00000000-0000-0000-0000-000000000000` e `created_at` zero) são ignorados.
- O servidor **esquece as salas a cada conexão** — o front re-envia `join` de todas as salas conhecidas no `open`, e refaz isso a cada reconexão.
- Sem otimismo na UI: a mensagem aparece quando o eco volta (não há `client_msg_id` pra deduplicar).
- `room:created` e `room:updated` atualizam a lista local sem recarregar. `room:deleted` remove a sala e seu histórico local; a conexão WebSocket permanece aberta.
- **Revogação/expiração de sessão**: o servidor fecha o WS com `CloseMessage` vazio → no browser `CloseEvent.code === 1005`. O front trata como "sessão morta" (desloga e para de reconectar), distinto de queda de rede/crash (`1006`), que tem retry com backoff.

## Limitações conhecidas

- **Presença/online, typing, upload e paginação não existem** no backend.
- Nenhuma privacidade por sala: qualquer logado lê e escreve em qualquer sala — o invite code é a única barreira.
- Cookie `SameSite=Lax`: em dev cross-origin (front num domínio diferente de `localhost:8080`) o cookie não viaja; auth funciona rodando o front localmente contra o Go, ou com o build servido pelo próprio Go.
