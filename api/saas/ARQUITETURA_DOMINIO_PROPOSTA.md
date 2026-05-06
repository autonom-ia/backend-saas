# Proposta de arquitetura de dominio para a API SaaS

## Leitura do padrao Jarvis

Os servicos do Jarvis seguem uma separacao que vale replicar no backend SaaS:

- `handlers`: adaptadores HTTP/Lambda. Devem extrair `pathParameters`, `queryStringParameters`, `body`, contexto de auth e chamar um caso de uso. Nao devem conter regra de negocio nem query direta.
- `schemas`: contratos de entrada, preferencialmente com Zod. A validacao acontece na borda.
- `modules/<dominio>/services`: casos de uso e regras de aplicacao. Aqui ficam validacoes de existencia, conflitos, defaults, sementes, orquestracao entre repositorios e chamadas externas.
- `modules/<dominio>/repositories`: persistencia por dominio/agregado. Aqui ficam Knex, SQL, transacoes, joins e mapeamento de rows.
- `presentation`: conversao do modelo persistido para resposta de API quando a resposta nao deve vazar detalhes internos.
- `shared`: erros, respostas HTTP, banco, auth, logging, CORS e utilitarios transversais.

O ponto mais importante: no Jarvis o handler e fino, o service decide, o repository persiste.

## Problema atual do `backend/api/saas`

Hoje o SaaS ja tem `handlers`, `services` e `utils`, mas a fronteira esta irregular:

- Alguns handlers fazem parse, validacao, regra, seed e queries diretas. Exemplo: criacao de produto tambem cria parametros e prompts.
- Services misturam casos de uso com queries de repositorio.
- Erros usam `Error` generico e sao traduzidos manualmente por handler.
- Falta contrato centralizado por endpoint, entao validacao e shape de payload tendem a divergir.
- Regras importantes ficam espalhadas: onboarding, assinatura, permissoes, WAHA, financial-service, prompts e parametros.

## Estrutura sugerida

```text
backend/api/saas/
  src/
    handlers/
      products/
      accounts/
      onboarding/
      inboxes/
      funnels/
      knowledge/
      agent-prompts/
      parameters/
      kanban/
      webhooks/
      metrics/
    modules/
      catalog/
        repositories/
        schemas/
        services/
      accounts/
        repositories/
        schemas/
        services/
      onboarding/
        repositories/
        schemas/
        services/
      conversations/
        repositories/
        schemas/
        services/
      inboxes/
        repositories/
        schemas/
        services/
      knowledge/
        repositories/
        schemas/
        services/
      agent-config/
        repositories/
        schemas/
        services/
      access-control/
        repositories/
        schemas/
        services/
      sales-funnel/
        repositories/
        schemas/
        services/
      integrations/
        clients/
        services/
      metrics/
        repositories/
        schemas/
        services/
    shared/
      database/
      errors/
      http/
      auth/
      logging/
      validation/
```

Se a migracao para TypeScript nao entrar agora, a mesma quebra pode ser feita em CommonJS:

```text
modules/catalog/repositories/product-repository.js
modules/catalog/services/create-product-service.js
modules/catalog/schemas/product-schema.js
```

## Quebra de dominios

### 1. `catalog`

Responsavel por produto, tipo de produto e relacao produto-empresa.

Endpoints:

- `Products`
- `ProductTypes`

Repositorios:

- `product.repository`
- `product-type.repository`
- `company.repository` somente para leituras necessarias ao catalogo

Services:

- `list-products.service`
- `get-product.service`
- `create-product.service`
- `update-product.service`
- `delete-product.service`
- `seed-product-defaults.service`

Observacao: a criacao de produto deve orquestrar a semente de parametros e prompts em service, nao no handler.

### 2. `accounts`

Responsavel por contas/clientes SaaS e vinculos de usuario.

Endpoints:

- `Accounts`
- `UserPermissions`

Repositorios:

- `account.repository`
- `user-account.repository`
- `user.repository`
- `user-access-profile.repository`

Services:

- `list-accounts.service`
- `get-account.service`
- `create-account.service`
- `update-account.service`
- `delete-account.service`
- `get-user-permissions.service`

Observacao: normalizacao de telefone, heranca de `conversation_funnel_id` e soft delete ficam aqui.

### 3. `onboarding`

Responsavel por fluxos compostos de criacao/configuracao inicial.

Endpoints:

- `Onboarding/Accounts`
- `Settings/Accounts/OnboardingWithCheckout`
- `Accounts/CompleteSubscription`
- `Accounts/{accountId}/CancelSubscription`
- `EVS/PartialRegister`
- `Products/{productId}/ParametersOnboarding`
- `Accounts/{accountId}/ParametersOnboarding`

Repositorios:

- Reusa `account.repository`, `account-parameter.repository`, `inbox.repository`, `user.repository`.
- Pode ter `onboarding.repository` se existir tabela propria de estado/idempotencia.

Services:

- `create-account-onboarding.service`
- `settings-onboarding-with-checkout.service`
- `complete-account-subscription.service`
- `cancel-account-subscription.service`
- `get-onboarding-parameters.service`

Observacao: este dominio deve ser um orquestrador. Ele chama repositorios de outros dominios via services publicos quando houver regra envolvida.

### 4. `agent-config`

Responsavel por prompts e parametros de agente/produto/conta.

Endpoints:

- `AgentPrompts`
- `AgentPromptsStandard`
- `ProductParameters`
- `ProductParametersStandard`
- `AccountParameters`
- `AccountParametersStandard`

Repositorios:

- `agent-prompt.repository`
- `agent-prompt-standard.repository`
- `product-parameter.repository`
- `product-parameter-standard.repository`
- `account-parameter.repository`
- `account-parameter-standard.repository`
- `product-type-instruction.repository`

Services:

- CRUDs de prompts e parametros
- `reactivate-agent-prompt.service`
- `seed-account-parameters.service`
- `seed-product-parameters.service`
- `seed-agent-prompts.service`

Observacao: padroes/standards entram nesse dominio porque sao templates de configuracao, nao entidades de catalogo.

### 5. `conversations`

Responsavel pela modelagem da conversa e funis.

Endpoints:

- `ConversationFunnels`
- `ConversationFunnelSteps`
- `ConversationFunnelStepMessages`

Repositorios:

- `conversation-funnel.repository`
- `conversation-funnel-step.repository`
- `conversation-funnel-step-message.repository`

Services:

- CRUDs dos tres agregados
- `list-default-funnels.service`
- `resolve-account-funnel.service`

Observacao: funil, step e mensagem podem ficar no mesmo dominio porque mudam em conjunto e compartilham regras de visibilidade/default.

### 6. `inboxes`

Responsavel por canais de atendimento e conexao WhatsApp/WAHA.

Endpoints:

- `Inboxes`
- `Inboxes/{inboxId}/PublicCreateSession`
- `Inboxes/{inboxId}/PublicConnectionState`
- `Inboxes/{inboxId}/PublicSyncWhatsappEnvironment`
- `Inboxes/{inboxId}/ConnectionLink`
- `InboxConnectionToken/{token}`
- `Inboxes/{inboxId}/NotifyConnectionLink`

Repositorios:

- `inbox.repository`
- `inbox-connection-token.repository` se existir persistencia para token/link

Services:

- CRUD de inbox
- `generate-inbox-connection-link.service`
- `get-inbox-connection-token.service`
- `notify-inbox-connection-link.service`
- `create-waha-session.service`
- `sync-whatsapp-environment.service`

Clients:

- `waha.client`
- `email.client` ou `email.service` em `integrations`

### 7. `knowledge`

Responsavel por documentos da base de conhecimento e sincronizacao.

Endpoints:

- `KnowledgeDocuments`
- `KnowledgeDocuments/{documentId}/sync`

Repositorios:

- `knowledge-document.repository`

Services:

- CRUD de documento
- `sync-knowledge-document.service`
- `upload-knowledge-document.service`, caso S3 fique encapsulado aqui

Clients:

- `s3.client`
- webhook/n8n client se a sincronizacao chamar pipeline externo

### 8. `sales-funnel`

Responsavel por itens de kanban/pipeline comercial.

Endpoints:

- `KanbanItems`

Repositorios:

- `kanban-item.repository`

Services:

- `list-kanban-items.service`
- `update-kanban-item.service`

Observacao: apesar do nome parecido, eu separaria de `conversations` porque kanban representa execucao/operacao comercial, nao definicao de fluxo conversacional.

### 9. `metrics`

Responsavel por estatisticas e leitura agregada.

Endpoints:

- `UserSessionAgentMessages/Stats`
- `Internal/UserSessionAgentMessages/Stats`

Repositorios:

- `user-session-agent-message.repository`
- `user-session.repository` somente leitura agregada

Services:

- `get-user-session-agent-message-stats.service`

### 10. `integrations`

Responsavel por chamadas externas e webhooks.

Endpoints:

- `Webhooks/n8n`
- `chatwoot-proxy`, se continuar nesse servico

Clients:

- `financial-service.client`
- `waha.client`
- `email.client`
- `n8n.client`
- `chatwoot.client`

Services:

- Services finos de orquestracao de chamadas externas.

Observacao: clients nao devem conhecer regra de dominio; eles so traduzem HTTP/Lambda externo para uma interface interna.

### 11. `access-control`

Responsavel por validacao de acesso, perfis e escopos.

Repositorios:

- `access-profile.repository`
- `user-company.repository`
- `user-access-profile.repository`
- `user-account.repository`

Services:

- `resolve-user-access-context.service`
- `assert-account-access.service`
- `assert-product-access.service`
- `list-user-companies.service`

Observacao: eu deixaria `access-control` como modulo compartilhado dentro da API SaaS, consumido pelos outros dominios.

## Contrato de cada endpoint

Cada endpoint deve seguir esta forma:

```text
handler -> schema.safeParse -> service -> repository/client -> presenter -> jsonResponse
```

Exemplo conceitual:

```js
// handlers/products/create-product.js
const parsed = createProductBodySchema.safeParse(JSON.parse(event.body || '{}'));
if (!parsed.success) throw new AppError('Invalid create product payload', 400, toZodErrorDetails(parsed.error));

const product = await createProduct(parsed.data, getActor(event));
return jsonResponse(201, { data: product }, event);
```

```js
// modules/catalog/services/create-product-service.js
async function createProduct(payload, actor) {
  assertRequiredCompany(payload.company_id);
  const product = await productRepository.create(payload, actor);
  await seedProductDefaults(product.id, payload.company_id, actor);
  return toProductResponse(product);
}
```

## Prioridade de migracao

1. Criar `shared/errors`, `shared/http`, `shared/validation` e `shared/database` no padrao Jarvis.
2. Migrar `catalog` primeiro, porque `create-product` concentra bastante regra indevida no handler.
3. Migrar `accounts` e `onboarding` em seguida, porque tem maior risco de regra duplicada.
4. Migrar `agent-config`, porque prompts/parametros sao usados como defaults por produto/conta.
5. Migrar `inboxes` e `knowledge`, isolando WAHA, email, S3 e sync externo como clients.
6. Migrar `conversations`, `sales-funnel` e `metrics`.

## Decisao recomendada

Eu criaria uma nova API SaaS internamente em `src/` e manteria os handlers atuais como camada de compatibilidade durante a transicao. O `serverless.yml` pode apontar endpoints novos para `src/handlers/...` aos poucos, sem quebrar o contrato publico `Autonomia/Saas/...`.

Nao recomendo separar cada tabela em um dominio proprio. A melhor granularidade aqui e por capacidade de negocio:

- catalogo
- contas
- onboarding
- configuracao do agente
- conversas/funis
- inbox/canais
- conhecimento
- pipeline comercial
- metricas
- integracoes
- controle de acesso

Essa quebra deixa um repositorio por agregado importante, mas evita virar um espelho mecanico do banco.
