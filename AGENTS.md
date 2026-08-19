> [!IMPORTANT]
> Não reescreva histórico publicado do `main` (force push, rebase/amend/squash de
> commits já empurrados) — o branch é a fonte de sincronização com o editor de
> origem deste projeto. Mantenha o branch sempre em estado funcional.

> [!NOTE]
> **Este arquivo vale para toda modificação de código no repo** — feita por humano,
> pelo dono do projeto ou por qualquer agente de IA, em qualquer arquivo, em
> qualquer tamanho de tarefa. Leia e siga antes de tocar em código. Não espere
> pedido: estas regras são o padrão, não uma opção de conversa.

## Padrões de código

Este repo segue os padrões do dono do projeto (espelho em `CONTRIBUTING.md`, arquitetura em `ARCHITECTURE.md`). Antes de escrever código, leia os dois. O essencial:

- **Early return** — caminho de erro sai primeiro; `else`/`else if` é exceção rara (se apareceu, extraia função).
- **Guard clause no topo** de handlers e funções com múltiplos casos.
- **Erro é tipo nomeado** — `ApiError` na rede; erro de formulário via factory nomeada (`authErrorMessageFor`), nunca chain de `else if`.
- **Identificador em inglês; mensagem ao usuário em pt-BR.**
- **Import por path alias `@/`** — nunca `../../..`.
- **Comentário é exceção** — se precisa explicar, melhore o nome ou extraia.
- **Teto de complexidade** — mais de 3–5 `if` por função pede extração.
- **Teste ao lado do código** — `X.spec.ts` junto de `X.ts`, lógica pura.
- **Domínio em `src/lib/vozzera/`** (api, types, hooks); componentes em `src/components/vozzera/` são apresentação pura; `src/routes/index.tsx` só costura.
- **Não editar** arquivos gerados/de infra: `src/components/ui/`, `src/routeTree.gen.ts`, `src/server.ts`, `src/start.ts`, `src/lib/error-*.ts`, `src/styles.css`, `vite.config.ts` (a menos que a tarefa seja explicitamente sobre build/DevOps).

Sempre valide com `npm run check` (roda lint + typecheck + testes + build de uma vez). Contrato com o backend: `docs/CONTRATO-FRONTEND.md`.

## Regras de ouro para agentes de código (LLM)

Este projeto é editado por agentes de IA. Presuma que **o CI e os hooks locais bloqueiam tudo** — e é isso que você quer: o portão existe para pegar o erro antes de você. Siga as regras ou seu commit será recusado.

1. **Nunca termine sem rodar `npm run check`.** As quatro etapas precisam passar. Se qualquer uma falhar, corrija o que você quebrou — não "esconda" o erro.
2. **Só toque no arquivo da tarefa.** Não reformate arquivos inteiros, não reordene imports de arquivos que você não alterou, não "arrume" código que já funciona. Diff mínimo.
3. **Não remova código que "parece não usado".** Muito código é usado indiretamente (registro de rotas, shadcn, SSR). Para remover, prove que não há referência.
4. **Não adicione dependência nova** sem motivo forte. O repo já tem React, TanStack Router, shadcn, tailwind, vitest. Prefira resolver com o que existe.
5. **Lógica de domínio nova = spec novo.** Se você adicionou lógica pura em `src/lib/vozzera/`, escreva `X.spec.ts` junto e rode `npm test`.
6. **Mudou o contrato de API/WS?** Atualize `docs/CONTRATO-FRONTEND.md` na mesma entrega.
7. **Sem comentários, sem `else`, sem console.log.** Se um catch ficar vazio, precisa de comentário de uma linha (o eslint exige).
8. **Mensagem ao usuário em pt-BR, nome de variável em inglês.** Sem exceção.
9. **Valores de UI (cores, espaçamento) vêm do design system** (`src/styles.css` / classes tailwind) — nunca hardcode um hex aleatório.
10. **Hook de pre-commit** roda lint-staged + typecheck + testes. Se o commit falhar, leia a mensagem e corrija; não pule o hook (`--no-verify`).

## Checklist de conformidade (obrigatório antes de terminar)

Toda tarefa que modifica código termina só quando TODOS os itens abaixo passam. Isso é auto-auditoria, não etapa opcional nem pedido do usuário:

1. `npm run check` passou de ponta a ponta (lint + typecheck + testes + build) — sem "esconder" erro.
2. **Diff mínimo:** só os arquivos da tarefa; nada de reformatar arquivo inteiro, reordenar imports de arquivo que não alterou ou "arrumar" código que já funciona.
3. Nenhum arquivo gerado/de infra tocado: `src/components/ui/`, `src/routeTree.gen.ts`, `src/server.ts`, `src/start.ts`, `src/lib/error-*.ts`, `src/styles.css`, `vite.config.ts`.
4. Lógica pura nova em `src/lib/vozzera/` tem `X.spec.ts` ao lado e o teste roda verde.
5. Mudou contrato de API/WS? `docs/CONTRATO-FRONTEND.md` atualizado na mesma entrega.
6. Zero `else` encadeado, zero comentário, zero `console.log` adicionados (catch vazio só com comentário de uma linha).
7. Identificadores em inglês; mensagem ao usuário em pt-BR.
8. Imports via alias `@/` — nunca `../../..`.
9. Regra de permissão/domínio mora em função pura (`src/lib/vozzera/permissions.ts` e afins), com spec ao lado — nunca boolean repetido inline no componente.
