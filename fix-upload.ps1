$file = 'c:\Users\NOTCROSBY02\gestaocrosby\src\pages\CrosbyBot.jsx'
$content = Get-Content $file -Raw

# Definir a nova função
$novaFuncao = @'
  // Função para fazer upload de mídia no Supabase Storage
  // Baseado em endividamentoApi.js
  const uploadMidia = async (file, messageId) => {
    if (!file) return null;

    const BUCKET_NAME = 'midias_bot';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado!');
      }

      // Gerar nome único para o arquivo
      const uid = crypto.randomUUID();

      // Determinar pasta baseado no tipo de arquivo
      let folder = 'outros';

      if (file.type.includes('image')) {
        folder = 'imagens';
      } else if (file.type.includes('video')) {
        folder = 'videos';
      } else if (file.type.includes('audio')) {
        folder = 'audios';
      } else if (file.type.includes('pdf')) {
        folder = 'pdfs';
      }

      // Caminho completo: folder/userId/uuid_filename
      const path = ${folder}//_;

      // Fazer upload para o Storage
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
          upsert: false
        });

      if (error) {
        // Verificar se é erro de bucket não encontrado
        if (error.message?.toLowerCase().includes('bucket') && 
            error.message?.toLowerCase().includes('not') && 
            error.message?.toLowerCase().includes('found')) {
          throw new Error(Bucket "" não encontrado no Supabase Storage);
        }
        throw error;
      }

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da mídia:', error);
      throw error;
    }
  };
'@

# Regex para encontrar a função antiga (da linha que começa com '  // Função para fazer upload' até o fechamento)
$pattern = '(?s)  // Função para fazer upload de mídia no Supabase Storage.*?^  };'

# Substituir
$content = $content -replace $pattern, $novaFuncao

# Salvar
$content | Out-File -FilePath $file -Encoding UTF8 -NoNewline

Write-Host '✅ Função uploadMidia atualizada com sucesso!'
