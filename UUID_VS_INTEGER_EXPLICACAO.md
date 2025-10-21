# 🔑 UUID vs INTEGER - Explicação do Problema

## 🤔 Sua Pergunta

> "O Supabase salva os ids como uuid e o nosso código só pega id? Porque não transformar nosso código para captar uuid?"

## ✅ Resposta

**Você está 100% correto!** O código **JÁ** está usando UUID. O problema é que a **tabela foi criada com o tipo errado**.

---

## 📊 Situação Atual

### No Código (Frontend)

```javascript
const { user } = useAuth();
console.log(user.id); // "76b8906e-7504-4da6-8f4a-8389802766c4"
// ↑ UUID (string)

// Passamos para o hook:
useDashboards(user?.id); // ✅ UUID correto
```

### No Banco de Dados (Supabase)

```sql
-- TABELA CRIADA COM TIPO ERRADO:
CREATE TABLE dashboards (
    id UUID,                    -- ✅ Correto
    created_by INTEGER,         -- ❌ ERRADO! Deveria ser UUID
    usuarios INTEGER[]          -- ❌ ERRADO! Deveria ser TEXT[] (UUIDs)
);
```

### O Problema

```javascript
// Frontend envia:
created_by: '76b8906e-7504-4da6-8f4a-8389802766c4'; // UUID (string)

// Banco espera:
created_by: 12345; // INTEGER

// Resultado:
// ❌ ERROR: invalid input syntax for type integer
```

---

## 🎯 A Solução

**NÃO** é mudar o código (já está correto com UUID).

**SIM** é corrigir o schema do banco:

```sql
-- De:
created_by INTEGER
usuarios INTEGER[]

-- Para:
created_by UUID
usuarios TEXT[] -- Array de UUIDs como strings
```

---

## 🔍 Por Que o Schema Estava Errado?

O arquivo `schema-widgets-dashboards.sql` foi criado assumindo IDs inteiros:

```sql
-- ❌ Schema inicial (errado):
usuarios INTEGER[] NOT NULL DEFAULT '{}',
created_by INTEGER NOT NULL,
```

Mas o Supabase Auth usa UUIDs para identificar usuários:

```javascript
// Supabase Auth sempre retorna UUID:
auth.uid() → "uuid-string"
user.id → "uuid-string"
```

---

## ✨ Resumo

| Item                            | Tipo Atual  | Tipo Correto | Status              |
| ------------------------------- | ----------- | ------------ | ------------------- |
| `user.id` (código)              | UUID string | UUID string  | ✅ OK               |
| `auth.uid()` (Supabase)         | UUID        | UUID         | ✅ OK               |
| `dashboards.created_by` (banco) | INTEGER     | **UUID**     | ❌ Precisa corrigir |
| `dashboards.usuarios` (banco)   | INTEGER[]   | **TEXT[]**   | ❌ Precisa corrigir |
| `widgets.created_by` (banco)    | INTEGER     | **UUID**     | ❌ Precisa corrigir |

---

## 🚀 Ação Necessária

Executar a migração que **corrige o schema do banco** para aceitar os UUIDs que o código já está enviando:

```sql
-- O script migration-integer-to-uuid.sql faz:
1. Remove todas as políticas RLS
2. Altera created_by: INTEGER → UUID
3. Altera usuarios: INTEGER[] → TEXT[]
4. Recria políticas RLS com UUIDs
```

---

## 💡 Conclusão

**Seu código está correto!** 👏

O problema não é "captar UUID" (já estamos fazendo isso).

O problema é que a **tabela foi criada com tipo incompatível**.

**Solução:** Executar `migration-integer-to-uuid.sql` no Supabase.

Após isso, tudo funcionará perfeitamente! 🎉

---

## 📝 Para Referência

### Código está correto:

```javascript
✅ const { user } = useAuth();
✅ useDashboards(user?.id); // UUID
✅ created_by: userId,      // UUID
✅ usuarios: [uuid1, uuid2] // Array de UUIDs
```

### Schema precisa de correção:

```sql
❌ created_by INTEGER
❌ usuarios INTEGER[]

✅ created_by UUID
✅ usuarios TEXT[]
```

**Tudo ficará alinhado após a migração!** 🚀
