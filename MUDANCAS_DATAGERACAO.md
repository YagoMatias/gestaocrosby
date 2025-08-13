# 🔄 Mudanças para Incluir DataGeracao na Chave Única

## 📋 Alterações Implementadas

### **✅ Banco de Dados:**
- ✅ Nova coluna `data_geracao` adicionada
- ✅ Índice único atualizado para incluir `data_geracao`
- ✅ Nova chave única: `nome_arquivo + valor + banco_nome + banco_codigo + data_geracao`

### **✅ Código JavaScript:**
- ✅ Função `verificarArquivoExistente` atualizada
- ✅ Função `salvarRetornoBancario` atualizada
- ✅ Página `ImportacaoRet` atualizada

## 🚀 Passos para Aplicar

### **Passo 1: Executar Script SQL**
Execute o arquivo `supabase_migration_datageracao.sql` no SQL Editor do Supabase:

```sql
-- 1. Adicionar nova coluna dataGeracao
ALTER TABLE retorno_bancario 
ADD COLUMN IF NOT EXISTS data_geracao TIMESTAMP WITH TIME ZONE;

-- 2. Remover índice único antigo
DROP INDEX IF EXISTS idx_retorno_bancario_unique_file;

-- 3. Criar novo índice único incluindo data_geracao
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo, data_geracao);
```

### **Passo 2: Verificar Mudanças**
Após executar o script, verifique se a coluna foi adicionada:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
AND column_name = 'data_geracao';
```

## 🔄 Nova Estrutura da Chave Única

### **Antes:**
```sql
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo);
```

### **Depois:**
```sql
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo, data_geracao);
```

### **Campos da Nova Chave:**
- **nome_arquivo**: Nome do arquivo .RET
- **valor**: Valor do saldo (decimal)
- **banco_nome**: Nome do banco
- **banco_codigo**: Código do banco
- **data_geracao**: Data de geração do arquivo (nova)

## 🔧 Código Atualizado

### **Arquivo: `src/lib/retornoBancario.js`**

#### **Função `verificarArquivoExistente` atualizada:**
```javascript
export const verificarArquivoExistente = async (nomeArquivo, valor, bancoNome, bancoCodigo, dataGeracao) => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('nome_arquivo', nomeArquivo)
      .eq('valor', valor)
      .eq('banco_nome', bancoNome)
      .eq('banco_codigo', bancoCodigo)
      .eq('data_geracao', dataGeracao)
      .single();

    // ... resto da lógica
  } catch (error) {
    // ... tratamento de erro
  }
};
```

#### **Função `salvarRetornoBancario` atualizada:**
```javascript
// Verificar se o arquivo já existe
const arquivoExiste = await verificarArquivoExistente(
  dados.nomeArquivo,
  dados.valor,
  dados.banco.nome,
  dados.banco.codigo,
  dados.dataGeracao
);

// Preparar dados para inserção
const dadosParaInserir = {
  // ... outros campos
  data_geracao: dados.dataGeracao,
  // ... resto dos campos
};
```

#### **Mensagem de erro melhorada:**
```javascript
return {
  success: false,
  message: `Arquivo "${dados.nomeArquivo}" com valor ${dados.valor} do banco ${dados.banco.nome} e data de geração ${new Date(dados.dataGeracao).toLocaleString('pt-BR')} já foi processado anteriormente`,
  duplicate: true
};
```

### **Arquivo: `src/pages/ImportacaoRet.jsx`**

#### **Dados para salvar atualizados:**
```javascript
const dadosParaSalvar = {
  nomeArquivo: resultado.arquivo.nomeOriginal,
  dataUpload: resultado.arquivo.dataUpload,
  valor: resultado.saldoAtual || parseFloat(resultado.saldoFormatado.replace(/[^\d.-]/g, '')),
  banco: resultado.banco,
  agencia: resultado.agencia,
  conta: resultado.conta,
  saldoFormatado: resultado.saldoFormatado,
  dataGeracao: resultado.dataGeracao // Nova informação
};
```

## ✅ Resultado Esperado

### **Antes:**
- ❌ Arquivos iguais com datas de geração diferentes eram salvos
- ❌ Chave única não incluía `data_geracao`

### **Depois:**
- ✅ Arquivos iguais com mesma data de geração são bloqueados
- ✅ Chave única: `nome_arquivo + valor + banco_nome + banco_codigo + data_geracao`
- ✅ Mensagem de erro inclui data de geração

## 🧪 Cenários de Teste

### **✅ Cenário 1: Arquivo Único**
1. Upload de arquivo `teste.RET` com valor `1000.00` e data de geração `2024-01-15`
2. ✅ Deve ser salvo com sucesso

### **✅ Cenário 2: Arquivo Duplicado (Mesma Data de Geração)**
1. Upload de arquivo `teste.RET` com valor `1000.00` e data de geração `2024-01-15` (mesmo banco)
2. ❌ Deve ser bloqueado com mensagem de erro

### **✅ Cenário 3: Arquivo Similar (Diferente Data de Geração)**
1. Upload de arquivo `teste.RET` com valor `1000.00` e data de geração `2024-01-16` (mesmo banco)
2. ✅ Deve ser salvo (data de geração diferente)

### **✅ Cenário 4: Arquivo Similar (Diferente Valor)**
1. Upload de arquivo `teste.RET` com valor `2000.00` e data de geração `2024-01-15` (mesmo banco)
2. ✅ Deve ser salvo (valor diferente)

### **✅ Cenário 5: Arquivo Similar (Diferente Banco)**
1. Upload de arquivo `teste.RET` com valor `1000.00` e data de geração `2024-01-15` (banco diferente)
2. ✅ Deve ser salvo (banco diferente)

## 📊 Estrutura da Nova Chave Única

### **Nova Chave:**
```sql
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo, data_geracao);
```

### **Campos da Chave:**
- **nome_arquivo**: Nome do arquivo .RET
- **valor**: Valor do saldo (decimal)
- **banco_nome**: Nome do banco
- **banco_codigo**: Código do banco
- **data_geracao**: Data de geração do arquivo (nova)

### **Campos Adicionados:**
- ✅ `data_geracao` (TIMESTAMP WITH TIME ZONE)

## 🔍 Verificações

### **Verificar Nova Coluna:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
AND column_name = 'data_geracao';
```

### **Verificar Índice Atualizado:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexname = 'idx_retorno_bancario_unique_file';
```

### **Verificar Duplicatas Existentes:**
```sql
SELECT 
    nome_arquivo, 
    valor, 
    banco_nome, 
    banco_codigo,
    data_geracao,
    COUNT(*) as quantidade
FROM retorno_bancario 
GROUP BY nome_arquivo, valor, banco_nome, banco_codigo, data_geracao
HAVING COUNT(*) > 1;
```

## 🎯 Benefícios

1. **Prevenção Mais Precisa**: Arquivos iguais com mesma data de geração não podem ser salvos
2. **Flexibilidade Temporal**: Mesmo arquivo pode ser processado em datas de geração diferentes
3. **Mensagens Mais Informativas**: Usuário sabe exatamente por que o arquivo foi bloqueado
4. **Integridade de Dados**: Maior precisão na identificação de duplicatas

## ⚠️ Observações

- **Dados Existentes**: Se houver duplicatas no banco, execute o script de limpeza
- **Teste Completo**: Teste com diferentes cenários antes de usar em produção
- **Backup**: Faça backup antes de executar as mudanças
- **Compatibilidade**: A nova coluna é opcional (nullable) para compatibilidade com dados existentes

## 🎯 Resultado Final

Agora o sistema oferece uma verificação de duplicatas muito mais precisa:

- **5 campos** na chave única (antes eram 4)
- **Data de geração** incluída na verificação
- **Mensagens mais detalhadas** para o usuário
- **Maior flexibilidade** para arquivos similares com datas diferentes

O sistema está mais robusto e preciso! 🚀
