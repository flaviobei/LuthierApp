-- =========================================================================================
-- MIGRATION: Corrigir RLS da tabela checklist_padrao e remover duplicidades
-- =========================================================================================

-- 1. Permitir que o Admin adicione e remova itens no checklist_padrao
-- Como a tabela não tem user_id, permitimos que usuários autenticados façam alterações
DROP POLICY IF EXISTS "Leitura Publica para Checklist Padrao" ON public.checklist_padrao;

CREATE POLICY "Permitir tudo no Checklist Padrao para logados" 
ON public.checklist_padrao
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 2. Limpar os itens duplicados que se acumularam
-- Mantém apenas 1 registro para cada combinação de (item_nome, tipo)
DELETE FROM public.checklist_padrao
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.checklist_padrao
  GROUP BY item_nome, tipo
);
