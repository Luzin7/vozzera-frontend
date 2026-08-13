# Contribuindo pro Vozzera (frontend)

Obrigado por querer contribuir. Antes de abrir PR, leia isto aqui — é curto.

## Comece aqui

```bash
git clone <fork>
cd <repo>
npm i
npm run dev
```

Front em `http://localhost:3000`. O app depende do backend Vozzera em `http://localhost:8080` (veja o repo do backend). Se o seu backend estiver em outra porta:

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

Trabalhe sempre em branch a partir de `main`. PR direto, sem develop/staging.

> Não reescreva histórico publicado no `main` (force push, rebase/amend/squash de commits já empurrados) — o branch é a fonte de sincronização com o editor de origem deste projeto.

## Antes de abrir PR

Rode isso na raiz:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Os quatro precisam passar. Se mexeu em lógica pura do domínio (`lib/vozzera/*.ts`), escreva o `spec.ts` junto — teste ao lado do código, sem framework de integração.

**Nunca commite** arquivos gerados (`src/routeTree.gen.ts`) nem arquivos locais (`.env`, paths, segredos).

## Convenções de código

Estas convenções são o espelho das regras do projeto. As que não são óbvias vêm com exemplo.

### Early return, sem `else`

Caminho de erro sai primeiro, caminho feliz fica sem indentação. `else` é exceção rara — se apareceu, normalmente cabia extrair função.

```ts
// ✅
if (err instanceof ApiError && err.status === 401) {
  setAuthed(false);
  return;
}
setAuthed(true);
```

```ts
// ❌
if (err instanceof ApiError && err.status === 401) {
  setAuthed(false);
} else {
  setAuthed(true);
}
```

### Guard clause no topo

Valida entrada antes de qualquer I/O. Se o primeiro guard é "não", sai cedo:

```ts
function openRoom(room: Room) {
  if (room.type !== "text") return;
  // daqui pra baixo room.type é text
}
```

### Erro é tipo nomeado

`ApiError` (com `status`) cobre a rede. Para traduzir status em mensagem de usuário, use uma factory nomeada — nunca chain de `else if` espalhado pelo componente:

```ts
export function authErrorMessageFor(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return "Código de convite inválido.";
  if (err instanceof ApiError && err.status === 409) return "Esse nome de usuário já está em uso.";
  if (err instanceof ApiError && err.status === 401) return "Usuário ou senha incorretos.";
  if (err instanceof ApiError) return err.message || "Não foi possível concluir.";
  return "Servidor indisponível. Ele está rodando?";
}
```

### Hook de domínio em `lib/vozzera`, componente é apresentação

Estado e efeitos (socket, REST, localStorage) moram em `lib/vozzera/`. Componentes em `components/vozzera/` recebem props e renderizam — não chamam API nem socket.

### Comentário é exceção

Se precisa comentar pra explicar, o código não está bom o suficiente — melhora o nome, extrai a função, nomeia a constante. Não comente decisão, data nem quem pediu.

### Complexidade por função

Mais de 3–5 `if` numa função é sinal de extração. As verificações viram uma função com nome (`canSend`, `authErrorMessageFor`), e a principal fica legível.

### Identificador em inglês, mensagem ao usuário em pt-BR

```ts
if (room.type === "voice") return; // nome em en
setBanner("Não consegui falar com o servidor."); // mensagem em pt
```

## Mensagens de commit

Conventional commits, em pt ou en (desde que consistente no PR):

| Prefixo     | Quando                                |
| ----------- | ------------------------------------- |
| `feat:`     | Nova funcionalidade                   |
| `fix:`      | Correção de bug                       |
| `refactor:` | Mudou código, não mudou comportamento |
| `docs:`     | Só documentação                       |
| `chore:`    | Deps, configs que não tocam runtime   |
| `ci:`       | Workflows do GitHub                   |
| `test:`     | Testes                                |

Exemplos:

```
feat: agrupar histórico por autor no MessageList
fix: reenviar join das salas abertas após reconectar
docs: atualizar CONTRATO-FRONTEND com edição de mensagem
```

Pode squash de commits intermediários no PR, mas cada commit final deve passar nos quatro comandos.

## Templates de issue e PR

- Bugs e features têm template YAML em `.github/ISSUE_TEMPLATE/`. Preencha o que for solicitado — isso economiza ida e volta.
- PRs colam o template de `.github/PULL_REQUEST_TEMPLATE.md` no corpo. O checklist ali é pra você rodar antes de pedir review.

## Onde pedir ajuda

Abra uma issue com o template `bug_report` se encontrar comportamento estranho. Se a dúvida for conceitual ("como funciona X?"), prefira Discussions em vez de issue — issues são pra rastrear trabalho. Iniciantes em frontend são bem-vindos. As convenções aqui são deliberadamente explícitas pra que você não precise adivinhar.
