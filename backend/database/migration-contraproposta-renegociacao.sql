-- =====================================================
-- MIGRATION: Sistema de Contraproposta para Renegociação
-- Data: 2025-11-27
-- Descrição: Adiciona colunas e triggers para sistema de
--            contrapropostas em solicitações de renegociação
-- =====================================================

-- 1. Adicionar novos status para contraproposta
-- =====================================================
ALTER TABLE solicitacoes_renegociacoes 
DROP CONSTRAINT IF EXISTS solicitacoes_renegociacoes_status_check;

ALTER TABLE solicitacoes_renegociacoes 
ADD CONSTRAINT solicitacoes_renegociacoes_status_check 
CHECK (status IN ('ANALISE', 'APROVADO', 'REPROVADO', 'CONTRAPROPOSTA', 'AGUARDANDO_ACEITE'));

-- 2. Adicionar coluna para armazenar a contraproposta
-- =====================================================
ALTER TABLE solicitacoes_renegociacoes 
ADD COLUMN IF NOT EXISTS contraproposta JSONB;

COMMENT ON COLUMN solicitacoes_renegociacoes.contraproposta IS 
'Armazena a contraproposta enviada pelo financeiro. Estrutura: {
  "vl_total": number,
  "forma_pagamento": string,
  "nr_parcelas": number,
  "vl_parcela": number,
  "observacao": string,
  "dt_envio": timestamp,
  "enviado_por": user_id,
  "user_aprovador": user_name
}';

-- 3. Adicionar coluna para histórico de negociação
-- =====================================================
ALTER TABLE solicitacoes_renegociacoes 
ADD COLUMN IF NOT EXISTS historico_negociacao JSONB[] DEFAULT '{}';

COMMENT ON COLUMN solicitacoes_renegociacoes.historico_negociacao IS 
'Array com histórico completo da negociação. Cada item: {
  "tipo": "SOLICITACAO|CONTRAPROPOSTA|ACEITE|RECUSA",
  "vl_total": number,
  "forma_pagamento": string,
  "nr_parcelas": number,
  "dt": timestamp,
  "user": user_name,
  "observacao": string
}';

-- 4. Criar tabela de notificações para renegociação
-- =====================================================
CREATE TABLE IF NOT EXISTS notificacoes_renegociacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES solicitacoes_renegociacoes(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'NOVA_SOLICITACAO',
    'CONTRAPROPOSTA_ENVIADA',
    'CONTRAPROPOSTA_ACEITA',
    'CONTRAPROPOSTA_RECUSADA',
    'APROVACAO',
    'REPROVACAO'
  )),
  destinatario_tipo VARCHAR(20) NOT NULL CHECK (destinatario_tipo IN ('FRANQUEADO', 'FINANCEIRO', 'ADMIN')),
  destinatario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  dados_adicionais JSONB,
  lida BOOLEAN DEFAULT FALSE,
  dt_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dt_leitura TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_renegociacao_destinatario ON notificacoes_renegociacao(destinatario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_renegociacao_solicitacao ON notificacoes_renegociacao(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_renegociacao_tipo ON notificacoes_renegociacao(tipo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_renegociacao_dt_criacao ON notificacoes_renegociacao(dt_criacao DESC);

-- 5. Função para criar notificação de nova solicitação
-- =====================================================
CREATE OR REPLACE FUNCTION notificar_nova_solicitacao_renegociacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar notificação para equipe financeira
  INSERT INTO notificacoes_renegociacao (
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
    'Nova Solicitação de Renegociação',
    format('A franquia %s solicitou renegociação de %s faturas no valor de %s',
      COALESCE(NEW.nm_empresa, 'CD: ' || NEW.cd_empresa),
      jsonb_array_length(COALESCE(NEW.faturas_selecionadas, '[]'::jsonb)),
      to_char(NEW.vl_total, 'FM999G999G999D00')
    ),
    jsonb_build_object(
      'cd_empresa', NEW.cd_empresa,
      'vl_total', NEW.vl_total,
      'forma_pagamento', NEW.forma_pagamento,
      'nr_parcelas', NEW.nr_parcelas
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar nova solicitação
DROP TRIGGER IF EXISTS trigger_notificar_nova_solicitacao_renegociacao ON solicitacoes_renegociacoes;
CREATE TRIGGER trigger_notificar_nova_solicitacao_renegociacao
  AFTER INSERT ON solicitacoes_renegociacoes
  FOR EACH ROW
  EXECUTE FUNCTION notificar_nova_solicitacao_renegociacao();

-- 6. Função para notificar contraproposta enviada
-- =====================================================
CREATE OR REPLACE FUNCTION notificar_contraproposta_renegociacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executar se o status mudou para CONTRAPROPOSTA
  IF NEW.status = 'CONTRAPROPOSTA' AND (OLD.status IS NULL OR OLD.status != 'CONTRAPROPOSTA') THEN

    -- Criar notificação para o franqueado
    INSERT INTO notificacoes_renegociacao (
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
      format('O financeiro enviou uma contraproposta para sua solicitação de renegociação: %s em %sx',
        to_char((NEW.contraproposta->>'vl_total')::numeric, 'FM999G999G999D00'),
        NEW.contraproposta->>'nr_parcelas'
      ),
      jsonb_build_object(
        'cd_empresa', NEW.cd_empresa,
        'contraproposta', NEW.contraproposta
      )
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar contraproposta
DROP TRIGGER IF EXISTS trigger_notificar_contraproposta_renegociacao ON solicitacoes_renegociacoes;
CREATE TRIGGER trigger_notificar_contraproposta_renegociacao
  AFTER UPDATE ON solicitacoes_renegociacoes
  FOR EACH ROW
  EXECUTE FUNCTION notificar_contraproposta_renegociacao();

-- 7. Função para notificar aceite ou recusa da contraproposta
-- =====================================================
CREATE OR REPLACE FUNCTION notificar_aceite_recusa_renegociacao()
RETURNS TRIGGER AS $$
DECLARE
  tipo_notificacao VARCHAR(50);
  titulo_msg TEXT;
  mensagem_texto TEXT;
BEGIN
  -- Detectar se houve aceite ou recusa de contraproposta
  IF OLD.status = 'CONTRAPROPOSTA' THEN

    IF NEW.status = 'APROVADO' THEN
      tipo_notificacao := 'CONTRAPROPOSTA_ACEITA';
      titulo_msg := 'Contraproposta Aceita';
      mensagem_texto := format('A franquia %s aceitou a contraproposta de renegociação',
        COALESCE(NEW.nm_empresa, 'CD: ' || NEW.cd_empresa)
      );
    ELSIF NEW.status = 'REPROVADO' THEN
      tipo_notificacao := 'CONTRAPROPOSTA_RECUSADA';
      titulo_msg := 'Contraproposta Recusada';
      mensagem_texto := format('A franquia %s recusou a contraproposta de renegociação',
        COALESCE(NEW.nm_empresa, 'CD: ' || NEW.cd_empresa)
      );
    ELSE
      RETURN NEW; -- Não criar notificação para outros status
    END IF;

    -- Criar notificação para equipe financeira
    INSERT INTO notificacoes_renegociacao (
      solicitacao_id,
      tipo,
      destinatario_tipo,
      titulo,
      mensagem,
      dados_adicionais
    ) VALUES (
      NEW.id,
      tipo_notificacao,
      'FINANCEIRO',
      titulo_msg,
      mensagem_texto,
      jsonb_build_object(
        'cd_empresa', NEW.cd_empresa,
        'status', NEW.status
      )
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar aceite/recusa
DROP TRIGGER IF EXISTS trigger_notificar_aceite_recusa_renegociacao ON solicitacoes_renegociacoes;
CREATE TRIGGER trigger_notificar_aceite_recusa_renegociacao
  AFTER UPDATE ON solicitacoes_renegociacoes
  FOR EACH ROW
  EXECUTE FUNCTION notificar_aceite_recusa_renegociacao();

-- 8. RLS Policies para notificações de renegociação
-- =====================================================
ALTER TABLE notificacoes_renegociacao ENABLE ROW LEVEL SECURITY;

-- Policy para visualizar notificações
DROP POLICY IF EXISTS select_notificacoes_renegociacao ON notificacoes_renegociacao;
CREATE POLICY select_notificacoes_renegociacao ON notificacoes_renegociacao
  FOR SELECT
  USING (
    auth.uid() = destinatario_id 
    OR destinatario_tipo IN ('FINANCEIRO', 'ADMIN')
  );

-- Policy para atualizar (marcar como lida)
DROP POLICY IF EXISTS update_notificacoes_renegociacao ON notificacoes_renegociacao;
CREATE POLICY update_notificacoes_renegociacao ON notificacoes_renegociacao
  FOR UPDATE
  USING (auth.uid() = destinatario_id);

-- 9. Criar histórico para renegociações existentes
-- =====================================================
UPDATE solicitacoes_renegociacoes
SET historico_negociacao = ARRAY[
  jsonb_build_object(
    'tipo', 'SOLICITACAO',
    'vl_total', vl_total,
    'forma_pagamento', forma_pagamento,
    'nr_parcelas', nr_parcelas,
    'dt', dt_solicitacao,
    'user', user_nome,
    'observacao', 'Solicitação inicial de renegociação'
  )
]
WHERE historico_negociacao IS NULL OR historico_negociacao = '{}';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Para reverter esta migration:
/*
DROP TRIGGER IF EXISTS trigger_notificar_aceite_recusa_renegociacao ON solicitacoes_renegociacoes;
DROP TRIGGER IF EXISTS trigger_notificar_contraproposta_renegociacao ON solicitacoes_renegociacoes;
DROP TRIGGER IF EXISTS trigger_notificar_nova_solicitacao_renegociacao ON solicitacoes_renegociacoes;
DROP FUNCTION IF EXISTS notificar_aceite_recusa_renegociacao();
DROP FUNCTION IF EXISTS notificar_contraproposta_renegociacao();
DROP FUNCTION IF EXISTS notificar_nova_solicitacao_renegociacao();
DROP TABLE IF EXISTS notificacoes_renegociacao;
ALTER TABLE solicitacoes_renegociacoes DROP COLUMN IF EXISTS historico_negociacao;
ALTER TABLE solicitacoes_renegociacoes DROP COLUMN IF EXISTS contraproposta;
*/
