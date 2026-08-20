-- =========================================================================================
-- MIGRATION: Habilitar RLS (Row Level Security) e Criar Políticas de Isolamento de Tenant
-- =========================================================================================

-- 1. Habilitar RLS em todas as tabelas (Impede leituras e escritas sem autenticação correta)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrumentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para tabelas principais (que possuem coluna user_id)
-- Obs: Se a sua tabela se chama de forma diferente ou não tem user_id, ajuste conforme necessário.

CREATE POLICY "Isolamento de Cliente" ON public.clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento de Instrumentos" ON public.instrumentos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento de Servicos" ON public.servicos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento de Transacoes" ON public.transacoes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento do Catalogo" ON public.catalogo
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento de Lista de Compras" ON public.lista_compras
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento de Configuracoes" ON public.configuracoes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Isolamento de Assinaturas" ON public.assinaturas
  FOR ALL USING (auth.uid() = user_id);

-- 3. Tabelas secundárias (que geralmente são ligadas via Foreign Key e não possuem user_id)
-- Caso as tabelas abaixo (ex: orcamento_itens, checklist) não possuam user_id, 
-- a política deve verificar a posse do serviço associado.

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolamento de Orcamento" ON public.orcamento_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.servicos WHERE servicos.id = servico_id AND servicos.user_id = auth.uid())
  );

ALTER TABLE public.checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolamento de Checklist" ON public.checklist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.servicos WHERE servicos.id = servico_id AND servicos.user_id = auth.uid())
  );

ALTER TABLE public.checklist_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolamento de Fotos Checklist" ON public.checklist_fotos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.servicos WHERE servicos.id = servico_id AND servicos.user_id = auth.uid())
  );

-- Obs: Tabelas globais, como checklist_padrao, que servem a todos os usuários, 
-- podem necessitar de política apenas para leitura (SELECT).
ALTER TABLE public.checklist_padrao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Publica para Checklist Padrao" ON public.checklist_padrao
  FOR SELECT USING (true);
