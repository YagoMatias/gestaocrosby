# Guia de Integração - Classificações Inadimplentes

## 📋 Resumo
Este documento explica como integrar o sistema de salvar/carregar classificações (Feeling e Status) no Supabase na página InadimplentesMultimarcas.

---

## 🗄️ 1. SCHEMA SQL - Criar Tabela no Supabase

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- Tabela para armazenar classificações de inadimplentes
CREATE TABLE classificacoes_inadimplentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_cliente VARCHAR(50) NOT NULL,
  nm_cliente VARCHAR(255) NOT NULL,
  valor_total DECIMAL(15, 2),
  ds_siglaest VARCHAR(2),
  situacao VARCHAR(20),
  feeling VARCHAR(50),
  status VARCHAR(50),
  usuario VARCHAR(255) NOT NULL,
  data_alteracao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cd_cliente)
);

CREATE INDEX idx_classificacoes_cd_cliente ON classificacoes_inadimplentes(cd_cliente);
CREATE INDEX idx_classificacoes_situacao ON classificacoes_inadimplentes(situacao);
CREATE INDEX idx_classificacoes_usuario ON classificacoes_inadimplentes(usuario);
CREATE INDEX idx_classificacoes_data ON classificacoes_inadimplentes(data_alteracao DESC);

ALTER TABLE classificacoes_inadimplentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler classificações" 
ON classificacoes_inadimplentes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir classificações" 
ON classificacoes_inadimplentes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar classificações" 
ON classificacoes_inadimplentes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar classificações" 
ON classificacoes_inadimplentes FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_classificacoes_inadimplentes_updated_at 
BEFORE UPDATE ON classificacoes_inadimplentes 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔧 2. ALTERAÇÕES NO ARQUIVO InadimplentesMultimarcas.jsx

### 2.1 Adicionar Imports no Início do Arquivo

```jsx
// No topo do arquivo, adicionar:
import { useAuth } from '../components/AuthContext';
import useClassificacoesInadimplentes from '../hooks/useClassificacoesInadimplentes';
import Notification from '../components/ui/Notification';
```

### 2.2 Adicionar Hook e Auth dentro do Componente

```jsx
const InadimplentesMultimarcas = () => {
  const apiClient = useApiClient();
  const { user } = useAuth(); // AUTH DO USUÁRIO
  const {
    salvarClassificacao,
    buscarClassificacoes,
    deletarClassificacao,
  } = useClassificacoesInadimplentes(); // HOOK CUSTOM
  
  // ... resto do código
```

### 2.3 Adicionar Estado para Notificações

```jsx
  // Adicionar após os estados existentes:
  const [notification, setNotification] = useState(null);
```

### 2.4 Carregar Classificações ao Buscar Dados

Modificar a função `fetchDados` para carregar as classificações:

```jsx
  const fetchDados = async () => {
    try {
      setLoading(true);

      const params = {
        dt_vencimento_ini: '2024-01-01',
      };

      if (filtroDataInicial) params.dt_inicio = filtroDataInicial;
      if (filtroDataFinal) params.dt_fim = filtroDataFinal;

      const response = await apiClient.financial.inadimplentesMultimarcas(params);

      if (response && response.length > 0) {
        setDados(response);
        
        // CARREGAR CLASSIFICAÇÕES DO SUPABASE
        const { success, data: classificacoesSalvas } = await buscarClassificacoes();
        
        if (success && classificacoesSalvas) {
          const feelingMap = {};
          const statusMap = {};
          
          classificacoesSalvas.forEach((c) => {
            if (c.feeling) {
              feelingMap[c.cd_cliente] = c.feeling;
            }
            if (c.status) {
              statusMap[c.cd_cliente] = c.status;
            }
          });
          
          setClienteFeeling(feelingMap);
          setClienteStatus(statusMap);
        }
      } else {
        setDados([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao carregar dados de inadimplentes',
      });
    } finally {
      setLoading(false);
    }
  };
```

### 2.5 Modificar Função de Salvar Feeling

Atualizar a função `salvarFeeling` para salvar no Supabase:

```jsx
  const salvarFeeling = async (cdCliente, e) => {
    e.stopPropagation();
    if (!tempFeeling) return;

    // Atualizar estado local
    setClienteFeeling((prev) => ({
      ...prev,
      [cdCliente]: tempFeeling,
    }));
    setEditandoFeeling(null);
    setTempFeeling('');

    // SALVAR NO SUPABASE
    const cliente = clientesAgrupados.find((c) => c.cd_cliente === cdCliente);
    
    if (cliente && user) {
      const classificacao = {
        cd_cliente: cliente.cd_cliente,
        nm_cliente: cliente.nm_cliente,
        valor_total: cliente.valor_total,
        ds_siglaest: cliente.ds_siglaest?.trim() || null,
        situacao: cliente.situacao,
        feeling: tempFeeling,
        status: clienteStatus[cdCliente] || null,
        usuario: user.email || user.id,
      };

      const { success, error } = await salvarClassificacao(classificacao);

      if (success) {
        setNotification({
          type: 'success',
          message: 'Feeling salvo com sucesso!',
        });
      } else {
        setNotification({
          type: 'error',
          message: `Erro ao salvar: ${error}`,
        });
      }
    }
  };
```

### 2.6 Modificar Função de Salvar Status

Atualizar a função `salvarStatus` para salvar no Supabase:

```jsx
  const salvarStatus = async (cdCliente, e) => {
    e.stopPropagation();
    if (!tempStatus) return;

    // Atualizar estado local
    setClienteStatus((prev) => ({
      ...prev,
      [cdCliente]: tempStatus,
    }));
    setEditandoStatus(null);
    setTempStatus('');

    // SALVAR NO SUPABASE
    const cliente = clientesAgrupados.find((c) => c.cd_cliente === cdCliente);
    
    if (cliente && user) {
      const classificacao = {
        cd_cliente: cliente.cd_cliente,
        nm_cliente: cliente.nm_cliente,
        valor_total: cliente.valor_total,
        ds_siglaest: cliente.ds_siglaest?.trim() || null,
        situacao: cliente.situacao,
        feeling: clienteFeeling[cdCliente] || null,
        status: tempStatus,
        usuario: user.email || user.id,
      };

      const { success, error } = await salvarClassificacao(classificacao);

      if (success) {
        setNotification({
          type: 'success',
          message: 'Status salvo com sucesso!',
        });
      } else {
        setNotification({
          type: 'error',
          message: `Erro ao salvar: ${error}`,
        });
      }
    }
  };
```

### 2.7 Adicionar Componente de Notificação no JSX

No final do JSX, antes do fechamento do componente:

```jsx
      {/* Notificação */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};
```

---

## 🎯 3. FUNCIONALIDADES IMPLEMENTADAS

### ✅ Salvar
- Ao clicar em "Salvar" no Feeling ou Status, os dados são salvos no Supabase
- Usa UPSERT (insere ou atualiza se já existir)

### ✅ Carregar
- Ao buscar dados com "Buscar Dados", as classificações salvas são carregadas automaticamente
- Os dropdowns são preenchidos com os valores salvos

### ✅ Atualizar
- Se o usuário alterar uma classificação já existente, ela é atualizada automaticamente

### ✅ Excluir (Opcional)
- Para adicionar função de excluir, pode usar `deletarClassificacao(cdCliente)`

---

## 📊 4. ESTRUTURA DE DADOS

### Objeto Classificação:
```javascript
{
  cd_cliente: "123456",
  nm_cliente: "Cliente Exemplo LTDA",
  valor_total: 15000.50,
  ds_siglaest: "SP",
  situacao: "INADIMPLENTE", // ou "ATRASADO"
  feeling: "POSSÍVEL PAGAMENTO", // ou "ATRASO"
  status: "ACORDO", // ou "ACORDO EM ANDAMENTO", "COBRANÇA", "PROTESTADO"
  usuario: "usuario@email.com",
  data_alteracao: "2025-01-10T14:30:00Z"
}
```

---

## 🔍 5. TESTANDO A INTEGRAÇÃO

1. **Criar a tabela no Supabase** (executar SQL)
2. **Verificar permissões RLS** (políticas devem estar ativas)
3. **Testar na aplicação:**
   - Buscar dados de inadimplentes
   - Selecionar um Feeling e clicar em Salvar
   - Verificar se aparece notificação de sucesso
   - Recarregar a página e buscar novamente
   - Ver se o Feeling/Status permanece selecionado

---

## 🚨 6. POSSÍVEIS ERROS E SOLUÇÕES

### Erro: "relation classificacoes_inadimplentes does not exist"
**Solução:** Executar o SQL de criação da tabela no Supabase

### Erro: "new row violates row-level security policy"
**Solução:** Verificar se as políticas RLS estão criadas corretamente

### Erro: "user is not authenticated"
**Solução:** Verificar se o usuário está logado (useAuth está funcionando)

### Dados não carregam após salvar
**Solução:** Verificar console do navegador para erros, verificar se `buscarClassificacoes()` está sendo chamado

---

## 📝 7. MELHORIAS FUTURAS (OPCIONAL)

1. **Botão "Salvar Tudo"**: Salvar todas as classificações de uma vez
2. **Histórico de Alterações**: Modal mostrando quem alterou e quando
3. **Exportar Classificações**: Baixar relatório com todas as classificações
4. **Filtro por Usuário**: Ver apenas classificações de determinado usuário
5. **Auditoria Visual**: Destacar linhas que foram modificadas recentemente

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Executar SQL no Supabase
- [ ] Criar arquivo `useClassificacoesInadimplentes.js` no diretório hooks
- [ ] Adicionar imports no `InadimplentesMultimarcas.jsx`
- [ ] Adicionar hook e auth dentro do componente
- [ ] Adicionar estado de notificação
- [ ] Modificar função `fetchDados`
- [ ] Modificar função `salvarFeeling`
- [ ] Modificar função `salvarStatus`
- [ ] Adicionar componente de notificação no JSX
- [ ] Testar funcionamento completo
