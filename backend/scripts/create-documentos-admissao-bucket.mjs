// Cria o bucket privado 'documentos-admissao' no Supabase Storage (documentos
// de admissão: RG, CPF, carteira de trabalho, etc). Idempotente.
// Uso: node scripts/create-documentos-admissao-bucket.mjs
import supabase from '../config/supabase.js';

const BUCKET = 'documentos-admissao';

const { data: existentes, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error('❌ Erro ao listar buckets:', listErr.message);
  process.exit(1);
}

if ((existentes || []).some((b) => b.name === BUCKET)) {
  console.log(`✅ Bucket '${BUCKET}' já existe — nada a fazer.`);
  process.exit(0);
}

const { error } = await supabase.storage.createBucket(BUCKET, {
  public: false, // privado — download só via signed URL gerada pela API
  fileSizeLimit: '15MB',
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
  ],
});
if (error) {
  console.error(`❌ Erro ao criar bucket '${BUCKET}':`, error.message);
  process.exit(1);
}
console.log(`✅ Bucket privado '${BUCKET}' criado com sucesso!`);
