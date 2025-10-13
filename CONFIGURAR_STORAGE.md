# 🚀 Guia Rápido: Configurar Storage para Crosby Bot

## ⚡ Passo a Passo (5 minutos)

### 1️⃣ Abrir Supabase

Acesse: https://supabase.com/dashboard/project/dorztqiunewggydvkjnf

### 2️⃣ Criar o Bucket (Via Interface - MAIS FÁCIL)

1. No menu lateral, clique em **"Storage"**
2. Clique no botão **"New bucket"** (verde, no canto superior direito)
3. Preencha:
   - **Name**: `midias_bot`
   - **Public bucket**: ✅ **MARQUE ESTA OPÇÃO** (muito importante!)
4. Clique em **"Create bucket"**

![image](https://github.com/user-attachments/assets/...)

### 3️⃣ Configurar Permissões (Via SQL)

1. No menu lateral, clique em **"SQL Editor"**
2. Clique em **"New query"**
3. Cole este código e clique em **"Run"**:

```sql
-- 1. Permitir que usuários autenticados façam upload
CREATE POLICY "Permitir upload para autenticados"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'midias_bot');

-- 2. Permitir que qualquer um leia os arquivos (público)
CREATE POLICY "Leitura pública"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'midias_bot');

-- 3. Permitir que usuários deletem apenas seus próprios arquivos
CREATE POLICY "Deletar próprios arquivos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'midias_bot');
```

### 4️⃣ Pronto! ✅

Agora teste no Crosby Bot:

1. Adicione uma mensagem com imagem/vídeo/áudio
2. Importe contatos
3. Clique em "Enviar Fluxo"

---

## 🔧 Alternativa: Criar por SQL (Se preferir)

Se você preferir fazer tudo por SQL:

```sql
-- 1. Criar o bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'midias_bot',
  'midias_bot',
  true,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'application/pdf'
  ]
);

-- 2. Aplicar as políticas (mesmo código do passo 3 acima)
```

---

## ❓ Solução de Problemas

### ❌ Erro: "Bucket 'midias_bot' não existe"

**Solução**: Volte ao passo 2 e crie o bucket

### ❌ Erro: "new row violates row-level security"

**Solução**: Execute o SQL do passo 3 (políticas de acesso)

### ❌ Erro: "File too large"

**Solução**: Execute no SQL Editor:

```sql
UPDATE storage.buckets
SET file_size_limit = 104857600 -- 100MB
WHERE id = 'midias_bot';
```

### ❌ Arquivos não aparecem

**Solução**: Verifique se marcou "Public bucket" no passo 2

---

## 🧪 Testar se está funcionando

Execute no SQL Editor:

```sql
-- Verificar se o bucket foi criado
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'midias_bot';

-- Deve retornar:
-- id: midias_bot
-- name: midias_bot
-- public: true
-- file_size_limit: 52428800
```

Se aparecer o resultado acima, está tudo certo! ✅

---

## 📊 Ver arquivos enviados

Para ver todos os arquivos que já foram enviados:

```sql
SELECT
  name,
  created_at,
  (metadata->>'size')::bigint / 1024 / 1024 as tamanho_mb,
  metadata->>'mimetype' as tipo
FROM storage.objects
WHERE bucket_id = 'midias_bot'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🗑️ Limpar arquivos antigos (Opcional)

Se quiser apagar arquivos com mais de 30 dias:

```sql
DELETE FROM storage.objects
WHERE bucket_id = 'midias_bot'
  AND created_at < NOW() - INTERVAL '30 days';
```

---

**Dúvidas?** Verifique os logs no console do navegador (F12) ao enviar uma mensagem.
