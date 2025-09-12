# Plano de Redução do Tamanho do Pacote (Leadshot)

Status legend:
- [ ] pendente
- [~] em progresso
- [x] concluído

## Itens

1. [x] Mover dependências de deploy para devDependencies no package.json (serverless, serverless-domain-manager)
2. [x] Otimizar instalação de produção no deploy (usar `npm ci --omit=dev --omit=optional --no-audit --no-fund`)
3. [x] Remover sourcemaps na minificação do build atual (terser) ou condicionar por stage
4. [ ] Restringir cópia de arquivos não-JS para `dist/` (excluir `.md`, `.map`, `package-lock.json`, `.env*`, `test/`)
5. [ ] Adicionar `package.individually: true` e `package.patterns` no `serverless.yml`
6. [x] Substituir `@aws-sdk/client-ssm` por `aws-sdk` v2 (pré-instalado no runtime Lambda) e ajustar código
7. [ ] Criar Lambda Layer para `pg`, `knex`, `ioredis` e referenciar nas funções
8. [ ] (Opcional) Migrar para `serverless-esbuild` (bundle + minify) e ajustar `serverless.yml`
9. [ ] Se usar esbuild, simplificar `deploy.sh` (remover `dist/` manual, minificação com terser e cópias)
10. [ ] (Opcional) Pruning pós-instalação se necessário (modclean/dedupe) — só se necessário

## Observações
- Começaremos pelos itens 1–5 para ganhos imediatos sem alterar o runtime.
- Itens 6–9 exigem ajustes de código e/ou estrutura; planejar em PRs separados.
- Medir tamanho dos pacotes após cada etapa para validar ganhos.
