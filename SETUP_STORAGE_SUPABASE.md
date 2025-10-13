# 📦 Configuração do Storage do Supabase para Crosby Bot

## 1. Criar Bucket de Storage

No painel do Supabase, vá em **Storage** e execute:

### Opção A: Via Interface (Recomendado)

1. Clique em **"Create bucket"**
2. Nome: `midias_bot`
3. **Public bucket**: ✅ Marque como público
4. Clique em **"Create bucket"**

### Opção B: Via SQL

```sql
-- Criar bucket público
INSERT INTO storage.buckets (id, name, public)
VALUES ('midias_bot', 'midias_bot', true);
```

## 2. Configurar Políticas de Acesso (RLS)

Execute no **SQL Editor**:

```sql
-- Permitir upload (INSERT) para usuários autenticados
CREATE POLICY "Permitir upload de mídias"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'midias_bot');

-- Permitir leitura pública (SELECT)
CREATE POLICY "Permitir leitura pública"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'midias_bot');

-- Permitir deletar apenas próprias mídias
CREATE POLICY "Permitir deletar próprias mídias"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'midias_bot'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## 3. Estrutura de Pastas

O sistema organiza automaticamente os arquivos em pastas:

```
midias_bot/
├── imagens/
│   └── {user_id}_{timestamp}_{messageId}.jpg
├── videos/
│   └── {user_id}_{timestamp}_{messageId}.mp4
├── audios/
│   └── {user_id}_{timestamp}_{messageId}.ogg
├── pdfs/
│   └── {user_id}_{timestamp}_{messageId}.pdf
└── outros/
    └── {user_id}_{timestamp}_{messageId}.*
```

## 4. Limites e Configurações

Configure limites no bucket (opcional):

```sql
-- Definir tamanho máximo de arquivo (50MB)
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'midias_bot';

-- Tipos de arquivo permitidos
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
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
WHERE id = 'midias_bot';
```

## 5. Testar Upload

Após configurar, teste fazendo:

1. Adicione uma mensagem de **Foto**, **Vídeo**, **Áudio** ou **PDF**
2. Faça upload do arquivo
3. Importe contatos
4. Clique em **"Visualizar Preview"**
5. Clique em **"Enviar Fluxo"**

Você verá o progresso: "Enviando mídia 1 de X..."

## 6. Verificar Uploads

Para ver os arquivos enviados:

```sql
-- Listar todos os arquivos no bucket
SELECT
  name,
  bucket_id,
  created_at,
  metadata->>'size' as tamanho,
  metadata->>'mimetype' as tipo
FROM storage.objects
WHERE bucket_id = 'midias_bot'
ORDER BY created_at DESC;
```

## 7. URLs Públicas

As URLs seguem o padrão:

```
https://dorztqiunewggydvkjnf.supabase.co/storage/v1/object/public/midias_bot/{pasta}/{arquivo}
```

Exemplo:

```
https://dorztqiunewggydvkjnf.supabase.co/storage/v1/object/public/midias_bot/imagens/user123_1234567890_msg1.jpg
```

## 8. Estrutura no Banco de Dados

Os dados salvos em `envio_em_massa` agora incluem URLs das mídias:

```json
{
  "tp_mensagem": [
    {
      "id": 1,
      "type": "https://msgapi.crosbytech.com.br/message/sendText/",
      "value": "Texto da mensagem"
    },
    {
      "id": 2,
      "type": "https://msgapi.crosbytech.com.br/message/sendMedia/",
      "value": "https://dorztqiunewggydvkjnf.supabase.co/storage/v1/object/public/midias_bot/imagens/..."
    }
  ],
  "nr_contato": "11999887766",
  "nm_nome": "João Silva",
  "cd_user": "user-id"
}
```

## 9. Troubleshooting

### Erro: "new row violates row-level security"

- Verifique se as políticas foram criadas corretamente
- Certifique-se de que o usuário está autenticado

### Erro: "Bucket not found"

- Verifique se o bucket `midias_bot` foi criado
- Nome deve ser exatamente `midias_bot`

### Erro: "File too large"

- Aumente o limite: `file_size_limit` no bucket
- Padrão: 50MB

### Mídias não aparecem

- Verifique se o bucket é **público**
- Teste a URL diretamente no navegador

## 10. Limpeza (Opcional)

Para limpar arquivos antigos:

```sql
-- Deletar arquivos com mais de 30 dias
DELETE FROM storage.objects
WHERE bucket_id = 'midias_bot'
  AND created_at < NOW() - INTERVAL '30 days';
```

---

## ✅ Checklist Final

- [ ] Bucket `midias_bot` criado e público
- [ ] Políticas RLS configuradas
- [ ] Limites de tamanho definidos (opcional)
- [ ] Tipos MIME permitidos configurados (opcional)
- [ ] Teste de upload realizado com sucesso
- [ ] URLs públicas acessíveis
