-- =====================================================
-- MIGRATION: Sistema de Contraproposta e Notificações
-- Data: 27/11/2025
-- Descrição: Adiciona suporte a contrapropostas, histórico de negociação e notificações
-- =====================================================

-- 1. Adicionar novos status permitidos
ALTER TABLE solicitacoes_credito 
DROP CONSTRAINT IF EXISTS solicitacoes_credito_status_check;

ALTER TABLE solicitacoes_credito 
ADD CONSTRAINT solicitacoes_credito_status_check 
CHECK (status IN ('ANALISE', 'CONTRAPROPOSTA', 'AGUARDANDO_ACEITE', 'APROVADO', 'REPROVADO'));

-- 2. Adicionar coluna para armazenar contraproposta
ALTER TABLE solicitacoes_credito 
ADD COLUMN IF NOT EXISTS contraproposta JSONB;

COMMENT ON COLUMN solicitacoes_credito.contraproposta IS 
'Armazena a contraproposta enviada pelo financeiro. Formato: {
  "vl_credito": number,
  "forma_pagamento": string,
  "nr_parcelas": number,
  "vl_parcela": number,
  "observacao": string,
  "dt_envio": timestamp,
  "enviado_por": string,
  "user_aprovador": string
}';

-- 3. Adicionar coluna para histórico de negociação
ALTER TABLE solicitacoes_credito 
ADD COLUMN IF NOT EXISTS historico_negociacao JSONB[] DEFAULT ARRAY[]::JSONB[];

COMMENT ON COLUMN solicitacoes_credito.historico_negociacao IS 
'Histórico completo da negociação. Cada entrada: {
  "tipo": "SOLICITACAO_INICIAL" | "CONTRAPROPOSTA" | "ACEITE" | "RECUSA" | "APROVACAO" | "REPROVACAO",
  "vl_credito": number,
  "forma_pagamento": string,
  "nr_parcelas": number,
  "dt": timestamp,
  "user": string,
  "observacao": string
}';

-- 4. Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notificacoes_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes_credito(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('NOVA_SOLICITACAO', 'CONTRAPROPOSTA_ENVIADA', 'CONTRAPROPOSTA_ACEITA', 'CONTRAPROPOSTA_RECUSADA', 'APROVACAO', 'REPROVACAO')),
  destinatario_tipo TEXT NOT NULL CHECK (destinatario_tipo IN ('FRANQUEADO', 'FINANCEIRO', 'ADMIN')),
  destinatario_id UUID, -- user_id do destinatário (pode ser null para notificações broadcast)
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados_adicionais JSONB,
  lida BOOLEAN DEFAULT FALSE,
  dt_criacao TIMESTAMP DEFAULT NOW(),
  dt_leitura TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario ON notificacoes_credito(destinatario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_solicitacao ON notificacoes_credito(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes_credito(tipo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_dt_criacao ON notificacoes_credito(dt_criacao DESC);

COMMENT ON TABLE notificacoes_credito IS 'Armazena todas as notificações relacionadas a solicitações de crédito';

-- 5. Função para criar notificação automática quando nova solicitação for criada
CREATE OR REPLACE FUNCTION notificar_nova_solicitacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar notificação para o financeiro
  INSERT INTO notificacoes_credito (
    solicitacao_id,
    tipo,
    destinatario_tipo,
    titulo,
    mensagem,
    dados_adicionais
  ) VALUES (
    NEW.id,
    'NOVA_SOLICITACAO',
    'FINANCEIRO',
    'Nova Solicitação de Crédito',
    format('A franquia %s solicitou crédito de %s', NEW.nm_empresa, NEW.vl_credito::money),
    jsonb_build_object(
      'cd_empresa', NEW.cd_empresa,
      'nm_empresa', NEW.nm_empresa,
      'vl_credito', NEW.vl_credito,
      'user_nome', NEW.user_nome,
      'user_email', NEW.user_email
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para notificação automática
DROP TRIGGER IF EXISTS trigger_notificar_nova_solicitacao ON solicitacoes_credito;
CREATE TRIGGER trigger_notificar_nova_solicitacao
  AFTER INSERT ON solicitacoes_credito
  FOR EACH ROW
  EXECUTE FUNCTION notificar_nova_solicitacao();

-- 7. Função para criar notificação quando contraproposta for enviada
CREATE OR REPLACE FUNCTION notificar_contraproposta()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se mudou para status CONTRAPROPOSTA
  IF NEW.status = 'CONTRAPROPOSTA' AND OLD.status != 'CONTRAPROPOSTA' THEN
    -- Criar notificação para o franqueado
    INSERT INTO notificacoes_credito (
      solicitacao_id,
      tipo,
      destinatario_tipo,
      destinatario_id,
      titulo,
      mensagem,
      dados_adicionais
    ) VALUES (
      NEW.id,
      'CONTRAPROPOSTA_ENVIADA',
      'FRANQUEADO',
      NEW.user_id,
      'Contraproposta Recebida',
      format('O financeiro enviou uma contraproposta para sua solicitação de crédito da franquia %s', NEW.nm_empresa),
      jsonb_build_object(
        'cd_empresa', NEW.cd_empresa,
        'nm_empresa', NEW.nm_empresa,
        'contraproposta', NEW.contraproposta
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para notificação de contraproposta
DROP TRIGGER IF EXISTS trigger_notificar_contraproposta ON solicitacoes_credito;
CREATE TRIGGER trigger_notificar_contraproposta
  AFTER UPDATE ON solicitacoes_credito
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notificar_contraproposta();

-- 8.1. Função para notificar aceite/recusa de contraproposta
CREATE OR REPLACE FUNCTION notificar_aceite_recusa()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se mudou para APROVADO vindo de CONTRAPROPOSTA (aceite)
  IF NEW.status = 'APROVADO' AND OLD.status = 'CONTRAPROPOSTA' THEN
    INSERT INTO notificacoes_credito (
      solicitacao_id,
      tipo,
      destinatario_tipo,
      titulo,
      mensagem,
      dados_adicionais
    ) VALUES (
      NEW.id,
      'CONTRAPROPOSTA_ACEITA',
      'FINANCEIRO',
      'Contraproposta Aceita',
      format('O franqueado %s ACEITOU a contraproposta de crédito da franquia %s', 
        COALESCE(NEW.user_nome, NEW.user_email), NEW.nm_empresa),
      jsonb_build_object(
        'cd_empresa', NEW.cd_empresa,
        'nm_empresa', NEW.nm_empresa,
        'contraproposta', NEW.contraproposta,
        'user_nome', NEW.user_nome,
        'user_email', NEW.user_email
      )
    );
  END IF;
  
  -- Verificar se mudou para REPROVADO vindo de CONTRAPROPOSTA (recusa)
  IF NEW.status = 'REPROVADO' AND OLD.status = 'CONTRAPROPOSTA' THEN
    INSERT INTO notificacoes_credito (
      solicitacao_id,
      tipo,
      destinatario_tipo,
      titulo,
      mensagem,
      dados_adicionais
    ) VALUES (
      NEW.id,
      'CONTRAPROPOSTA_RECUSADA',
      'FINANCEIRO',
      'Contraproposta Recusada',
      format('O franqueado %s RECUSOU a contraproposta de crédito da franquia %s', 
        COALESCE(NEW.user_nome, NEW.user_email), NEW.nm_empresa),
      jsonb_build_object(
        'cd_empresa', NEW.cd_empresa,
        'nm_empresa', NEW.nm_empresa,
        'contraproposta', NEW.contraproposta,
        'user_nome', NEW.user_nome,
        'user_email', NEW.user_email
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8.2. Trigger para notificação de aceite/recusa
DROP TRIGGER IF EXISTS trigger_notificar_aceite_recusa ON solicitacoes_credito;
CREATE TRIGGER trigger_notificar_aceite_recusa
  AFTER UPDATE ON solicitacoes_credito
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notificar_aceite_recusa();

-- 9. Políticas RLS para notificações
ALTER TABLE notificacoes_credito ENABLE ROW LEVEL SECURITY;

-- Política: Usuários veem apenas suas próprias notificações ou notificações para FINANCEIRO/ADMIN se tiverem permissão
DROP POLICY IF EXISTS "Usuários podem ver suas notificações" ON notificacoes_credito;
CREATE POLICY "Usuários podem ver suas notificações" ON notificacoes_credito
  FOR SELECT
  USING (
    auth.uid() = destinatario_id 
    OR 
    destinatario_tipo IN ('FINANCEIRO', 'ADMIN')
  );

-- Política: Usuários podem marcar suas notificações como lidas
DROP POLICY IF EXISTS "Usuários podem atualizar suas notificações" ON notificacoes_credito;
CREATE POLICY "Usuários podem atualizar suas notificações" ON notificacoes_credito
  FOR UPDATE
  USING (auth.uid() = destinatario_id);

-- 10. Função auxiliar para registrar histórico
CREATE OR REPLACE FUNCTION adicionar_historico_negociacao(
  p_solicitacao_id UUID,
  p_tipo TEXT,
  p_vl_credito DECIMAL,
  p_forma_pagamento TEXT,
  p_nr_parcelas INTEGER,
  p_user TEXT,
  p_observacao TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE solicitacoes_credito
  SET historico_negociacao = historico_negociacao || jsonb_build_object(
    'tipo', p_tipo,
    'vl_credito', p_vl_credito,
    'forma_pagamento', p_forma_pagamento,
    'nr_parcelas', p_nr_parcelas,
    'dt', NOW(),
    'user', p_user,
    'observacao', p_observacao
  )::JSONB
  WHERE id = p_solicitacao_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION adicionar_historico_negociacao IS 
'Função auxiliar para adicionar entrada no histórico de negociação de uma solicitação';

-- 11. Criar histórico inicial para solicitações existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM solicitacoes_credito WHERE historico_negociacao = ARRAY[]::JSONB[]
  LOOP
    UPDATE solicitacoes_credito
    SET historico_negociacao = ARRAY[
      jsonb_build_object(
        'tipo', 'SOLICITACAO_INICIAL',
        'vl_credito', r.vl_credito,
        'forma_pagamento', r.forma_pagamento,
        'nr_parcelas', r.nr_parcelas,
        'dt', r.dt_solicitacao,
        'user', COALESCE(r.user_nome, r.user_email, 'Sistema'),
        'observacao', r.motivo
      )
    ]::JSONB[]
    WHERE id = r.id;
  END LOOP;
END $$;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Verificar estrutura atualizada
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'solicitacoes_credito'
ORDER BY ordinal_position;

-- Contar notificações criadas
SELECT COUNT(*) as total_notificacoes FROM notificacoes_credito;
