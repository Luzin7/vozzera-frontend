<!-- Cole o número da issue que este PR fecha: -->

Closes #

## Resumo

<!-- Uma ou duas frases: o que mudou e por quê. -->

## Tipo

- [ ] `feat:` nova funcionalidade
- [ ] `fix:` correção de bug
- [ ] `refactor:` mudou código, não mudou comportamento
- [ ] `docs:` só documentação
- [ ] `chore:` deps / configs
- [ ] `ci:` workflows do GitHub
- [ ] `test:` testes

## Onde mexi

- [ ] `src/lib/vozzera` (api, types, hooks)
- [ ] `src/components/vozzera` (features)
- [ ] `src/routes`
- [ ] `src/components/ui` (só se vier de `npx shadcn add`)
- [ ] `src/styles.css`
- [ ] docs / templates

## Checklist antes de pedir review

- [ ] `npm run lint` passa
- [ ] `npm run typecheck` passa
- [ ] `npm run build` passa
- [ ] `npm test` passa (se mexi em lógica pura do domínio, escrevi o `spec.ts` junto)
- [ ] Não tem `else` onde cabia early return
- [ ] Não tem comentário explicando o óbvio — nome/extração comunicam
- [ ] Mensagens ao usuário em pt-BR; identificadores em inglês
- [ ] Não editei arquivos gerados (`src/routeTree.gen.ts`) nem boilerplate (`src/server.ts`, `src/start.ts`, `src/lib/error-*.ts`)
- [ ] Scripts/logs/segredos não foram commitados

## Screenshots / logs

<!-- Se mexeu em WebSocket, layout ou fluxo que não dá pra ver com teste, cole print/log mostrando funcionando. -->
