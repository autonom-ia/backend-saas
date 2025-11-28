# Dívidas Técnicas

## 2025-11-26 - Associação user_accounts na criação de conta

- **Contexto**: Hoje o vínculo usuário-conta é feito no handler `api/saas/handlers/create-account.js`, recebendo `user_id` no corpo da requisição.
- **Problema**: O `user_id` deveria ser obtido preferencialmente do usuário autenticado (token) e não confiado diretamente via body. Além disso, a lógica de exceção por perfil (EXCLUDED_PROFILE) precisa ser revisada e centralizada.
- **Decisão atual**: O fluxo de `register` foi ajustado para **não** inserir em `user_accounts`. A associação continua sendo feita apenas na criação de conta.
- **Ação futura sugerida**:
  - Extrair `user_id` a partir do token de autenticação no `create-account`, evitando depender do campo `user_id` no body.
  - Revisar a política de perfis que impedem a associação automática (constante `EXCLUDED_PROFILE`).
  - Considerar mover essa lógica para um serviço compartilhado que trate associações entre `users`, `accounts` e `companies` de forma consistente.
