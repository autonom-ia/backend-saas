-- Script para atualizar usuários existentes após migration de is_first_login
-- 
-- Objetivo: Marcar usuários que já existiam ANTES da migration como is_first_login = false
-- para que não sejam redirecionados para onboarding em seu próximo login
--
-- IMPORTANTE: Executar este script APÓS rodar a migration 20251115120000_add_is_first_login_to_users.js
--
-- Data de execução recomendada: Imediatamente após migration em produção
--

-- Opção 1: Marcar TODOS os usuários existentes como já logados (RECOMENDADO)
-- Isso evita que usuários que já usam o sistema sejam redirecionados para onboarding
UPDATE users 
SET is_first_login = false, 
    updated_at = NOW()
WHERE created_at < NOW();

-- Resultado esperado: Atualiza todos os usuários criados antes de executar este script

-- Para verificar quantos usuários foram atualizados:
SELECT COUNT(*) as total_usuarios_atualizados 
FROM users 
WHERE is_first_login = false;

-- Para ver os usuários que ainda estão marcados como primeiro login:
SELECT id, email, name, created_at, is_first_login 
FROM users 
WHERE is_first_login = true;

-- Caso queira atualizar apenas usuários criados antes de uma data específica:
-- UPDATE users 
-- SET is_first_login = false, 
--     updated_at = NOW()
-- WHERE created_at < '2025-11-15 00:00:00';
