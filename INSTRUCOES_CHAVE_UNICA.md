# 🔧 Instruções para Nova Chave Única

## 📋 Mudança Solicitada

Remover a data da chave única e usar apenas:
- `nome_arquivo`
- `valor` 
- `banco_nome`
- `banco_codigo`

## 🚀 Passos para Aplicar

### **Passo 1: Executar Script SQL**
Execute o arquivo `supabase_migration_unique_fix.sql` no SQL Editor do Supabase:

```sql
-- 1. Remover índice único antigo
DROP INDEX IF EXISTS idx_retorno_bancario_unique_file;

-- 2. Criar novo índice único sem data
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo);
```

### **Passo 2: Verificar Mudanças**
Após executar o script, verifique se o índice foi criado corretamente:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexname = 'idx_retorno_bancario_unique_file';
```

### **Passo 3: Testar Funcionalidade**
1. Faça upload de um arquivo .RET
2. Tente fazer upload do mesmo arquivo novamente
3. Deve aparecer erro de duplicata no frontend

## 🔄 Código Atualizado

### **Arquivo: `src/lib/retornoBancario.js`**

#### **Função `verificarArquivoExistente` atualizada:**
```javascript
export const verificarArquivoExistente = async (nomeArquivo, valor, bancoNome, bancoCodigo) => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('nome_arquivo', nomeArquivo)
      .eq('valor', valor)
      .eq('banco_nome', bancoNome)
      .eq('banco_codigo', bancoCodigo)
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
  dados.banco.codigo
);
```

#### **Mensagem de erro melhorada:**
```javascript
return {
  success: false,
  message: `Arquivo "${dados.nomeArquivo}" com valor ${dados.valor} do banco ${dados.banco.nome} já foi processado anteriormente`,
  duplicate: true
};
```

## ✅ Resultado Esperado

### **Antes:**
- ❌ Arquivos iguais com datas diferentes eram salvos
- ❌ Chave única incluía `data_upload`

### **Depois:**
- ✅ Arquivos iguais são bloqueados independente da data
- ✅ Chave única: `nome_arquivo + valor + banco_nome + banco_codigo`
- ✅ Mensagem de erro clara no frontend

## 🧪 Teste de Funcionalidade

### **Cenário 1: Arquivo Único**
1. Upload de arquivo `teste.RET` com valor `1000.00`
2. ✅ Deve ser salvo com sucesso

### **Cenário 2: Arquivo Duplicado**
1. Upload de arquivo `teste.RET` com valor `1000.00` (mesmo banco)
2. ❌ Deve ser bloqueado com mensagem de erro

### **Cenário 3: Arquivo Similar (Diferente Valor)**
1. Upload de arquivo `teste.RET` com valor `2000.00` (mesmo banco)
2. ✅ Deve ser salvo (valor diferente)

### **Cenário 4: Arquivo Similar (Diferente Banco)**
1. Upload de arquivo `teste.RET` com valor `1000.00` (banco diferente)
2. ✅ Deve ser salvo (banco diferente)

## 📊 Estrutura da Chave Única

### **Nova Chave:**
```sql
CREATE UNIQUE INDEX idx_retorno_bancario_unique_file 
ON retorno_bancario(nome_arquivo, valor, banco_nome, banco_codigo);
```

### **Campos da Chave:**
- **nome_arquivo**: Nome do arquivo .RET
- **valor**: Valor do saldo (decimal)
- **banco_nome**: Nome do banco
- **banco_codigo**: Código do banco

### **Campos Removidos da Chave:**
- ~~data_upload~~ (removido)

## 🔍 Verificações

### **Verificar Índice:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexdef LIKE '%UNIQUE%';
```

### **Verificar Duplicatas Existentes:**
```sql
SELECT 
    nome_arquivo, 
    valor, 
    banco_nome, 
    banco_codigo,
    COUNT(*) as quantidade
FROM retorno_bancario 
GROUP BY nome_arquivo, valor, banco_nome, banco_codigo
HAVING COUNT(*) > 1;
```

### **Limpar Duplicatas (se necessário):**
```sql
DELETE FROM retorno_bancario 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM retorno_bancario 
    GROUP BY nome_arquivo, valor, banco_nome, banco_codigo
);
```

## 🎯 Benefícios

1. **Prevenção Real de Duplicatas**: Arquivos iguais não podem ser salvos
2. **Flexibilidade de Data**: Mesmo arquivo pode ser processado em datas diferentes
3. **Mensagens Claras**: Usuário sabe exatamente por que o arquivo foi bloqueado
4. **Performance**: Índice mais eficiente sem data

## ⚠️ Observações

- **Dados Existentes**: Se houver duplicatas no banco, execute o script de limpeza
- **Teste Completo**: Teste com diferentes cenários antes de usar em produção
- **Backup**: Faça backup antes de executar as mudanças
