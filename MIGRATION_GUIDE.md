# 🚀 Guia de Migração - Antecipações de Faturas

## Passo a Passo para Configurar o Banco de Dados

### 1️⃣ Acessar o Supabase Dashboard

1. Abra o navegador e acesse: https://app.supabase.com
2. Faça login com suas credenciais
3. Selecione o projeto **gestaocrosby** (ou o nome do seu projeto)

### 2️⃣ Executar a Migration SQL

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique no botão **New Query** (+ Nova Query)
3. Abra o arquivo `database/schema-antecipacoes.sql` do projeto
4. Copie **TODO** o conteúdo do arquivo
5. Cole no editor SQL do Supabase
6. Clique no botão **Run** (ou pressione `Ctrl + Enter` / `Cmd + Enter`)
7. Aguarde a execução (deve aparecer "Success. No rows returned")

### 3️⃣ Verificar se a Tabela foi Criada

Execute esta query no SQL Editor para confirmar:

```sql
SELECT * FROM antecipacoes_faturas LIMIT 1;
```

✅ **Resultado esperado**: "0 rows" (tabela vazia, mas criada com sucesso)

### 4️⃣ Verificar as Políticas de Segurança (RLS)

Execute esta query:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'antecipacoes_faturas';
```

✅ **Resultado esperado**: 4 políticas devem aparecer:

- Usuários podem ver suas próprias antecipações (SELECT)
- Usuários podem criar antecipações (INSERT)
- Usuários podem atualizar suas próprias antecipações (UPDATE)
- Usuários podem deletar suas próprias antecipações (DELETE)

### 5️⃣ Testar a Aplicação

1. Abra a aplicação no navegador
2. Navegue até **Auditoria de Antecipações**
3. Faça uma busca de faturas
4. Selecione algumas linhas
5. Clique em **SALVAR ANTECIPAÇÃO**
6. Escolha um banco
7. Clique em **Confirmar**

✅ **Resultado esperado**:

- Mensagem de sucesso
- Faturas marcadas com badge verde do banco
- Dados persistem ao recarregar a página

### 6️⃣ Verificar Dados Salvos no Banco

No SQL Editor, execute:

```sql
SELECT
  cd_cliente,
  nr_fatura,
  banco_antecipado,
  usuario_email,
  created_at
FROM antecipacoes_faturas
ORDER BY created_at DESC
LIMIT 10;
```

Você deverá ver as antecipações que acabou de criar!

---

## 🔧 Solução de Problemas Comuns

### Erro: "relation 'antecipacoes_faturas' does not exist"

**Causa**: A tabela não foi criada
**Solução**: Execute novamente o arquivo `schema-antecipacoes.sql`

### Erro: "new row violates row-level security policy"

**Causa**: Usuário não está autenticado ou problema nas políticas RLS
**Solução**:

1. Verifique se você está logado na aplicação
2. Verifique se as políticas RLS foram criadas corretamente
3. Execute a query de verificação das políticas (passo 4)

### Erro: "duplicate key value violates unique constraint"

**Causa**: Tentando inserir uma fatura que já foi antecipada
**Solução**:

- Isso é esperado! O sistema usa `upsert` para atualizar o banco se necessário
- Se persistir, verifique a implementação do `upsert` no código

### Antecipações não aparecem após recarregar

**Causa**: Problema ao carregar dados do Supabase
**Solução**:

1. Abra o Console do Navegador (F12)
2. Procure por erros relacionados ao Supabase
3. Verifique se a função `carregarAntecipacoes()` está sendo chamada
4. Verifique as políticas RLS

---

## 📊 Queries Úteis para Administração

### Ver todas as antecipações

```sql
SELECT * FROM antecipacoes_faturas
ORDER BY created_at DESC;
```

### Contar antecipações por banco

```sql
SELECT
  banco_antecipado,
  COUNT(*) as total,
  SUM(vl_fatura) as valor_total
FROM antecipacoes_faturas
GROUP BY banco_antecipado;
```

### Ver antecipações de hoje

```sql
SELECT * FROM antecipacoes_faturas
WHERE DATE(created_at) = CURRENT_DATE;
```

### Ver quem mais registrou antecipações

```sql
SELECT
  usuario_nome,
  usuario_email,
  COUNT(*) as total_antecipacoes
FROM antecipacoes_faturas
GROUP BY usuario_nome, usuario_email
ORDER BY total_antecipacoes DESC;
```

### Deletar todas as antecipações (CUIDADO!)

```sql
-- ⚠️ Use com cautela!
DELETE FROM antecipacoes_faturas;
```

---

## ✅ Checklist Final

- [ ] Tabela `antecipacoes_faturas` criada
- [ ] 4 políticas RLS ativas
- [ ] 6 índices criados
- [ ] Trigger de `updated_at` funcionando
- [ ] Aplicação salvando dados no Supabase
- [ ] Aplicação carregando dados do Supabase
- [ ] Badges de banco aparecendo nas faturas antecipadas
- [ ] Filtros de antecipação funcionando

---

## 📞 Suporte

Se encontrar problemas durante a migração:

1. Verifique os logs do navegador (Console - F12)
2. Verifique os logs do Supabase (Database > Logs)
3. Consulte o arquivo `README-antecipacoes.md` para mais detalhes
4. Revise o código em `src/pages/AuditoriaAntecipacoes.jsx`

---

**Data de Criação**: 14/12/2024
**Última Atualização**: 14/12/2024
