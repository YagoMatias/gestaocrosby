import React, { useState } from 'react';
import {
  Upload,
  Download,
  FileText,
  WarningCircle,
  CheckCircle,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';

export default function AjusteRetorno() {
  const [arquivo, setArquivo] = useState(null);
  const [conteudoOriginal, setConteudoOriginal] = useState('');
  const [sequenciaAtual, setSequenciaAtual] = useState('');
  const [sequenciaCorreta, setSequenciaCorreta] = useState('');
  const [conteudoAjustado, setConteudoAjustado] = useState('');
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [processando, setProcessando] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.ret')) {
      setMensagem({
        tipo: 'erro',
        texto: 'Por favor, selecione um arquivo .txt ou .ret',
      });
      return;
    }

    setArquivo(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      const conteudo = e.target.result;
      setConteudoOriginal(conteudo);

      // Detectar a sequência atual olhando apenas o final da linha (ex: 012000001)
      // Padrão: espaços + três dígitos (sequência) + '000' + três dígitos (NSR) no fim da linha
      const linhas = conteudo.split('\n');
      let detectado = '';
      for (const linha of linhas) {
        const m = linha.match(/\s*(\d{3})000\d{3}\s*$/);
        if (m) {
          detectado = m[1];
          break;
        }
      }

      if (detectado) {
        setSequenciaAtual(detectado);
        setMensagem({
          tipo: 'info',
          texto: `Arquivo carregado! Sequência detectada: ${detectado}000XXX`,
        });
      } else {
        setMensagem({
          tipo: 'aviso',
          texto:
            'Arquivo carregado, mas não foi possível detectar automaticamente a sequência. Digite manualmente.',
        });
      }
    };

    reader.onerror = () => {
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao ler o arquivo',
      });
    };

    reader.readAsText(file);
  };

  const processarAjuste = () => {
    if (!conteudoOriginal) {
      setMensagem({
        tipo: 'erro',
        texto: 'Nenhum arquivo carregado',
      });
      return;
    }

    if (!sequenciaCorreta || sequenciaCorreta.length !== 3) {
      setMensagem({
        tipo: 'erro',
        texto: 'Digite a sequência correta (3 dígitos, ex: 015)',
      });
      return;
    }

    if (!/^\d{3}$/.test(sequenciaCorreta)) {
      setMensagem({
        tipo: 'erro',
        texto: 'A sequência deve conter apenas 3 dígitos numéricos',
      });
      return;
    }

    setProcessando(true);

    try {
      // Substituir todas as ocorrências da sequência antiga pela nova
      const linhas = conteudoOriginal.split('\n');
      const linhasAjustadas = linhas.map((linha) => {
        // Ajustar apenas o sufixo da linha no formato ... <espaços> XXX000YYY
        // Preserva os espaços antes do sufixo e substitui somente a sequência
        const regexSufixo = new RegExp(
          `(\\s*)${sequenciaAtual}000(\\d{3})\\s*$`,
        );
        return linha.replace(regexSufixo, `$1${sequenciaCorreta}000$2`);
      });

      const novoConteudo = linhasAjustadas.join('\n');
      setConteudoAjustado(novoConteudo);

      setMensagem({
        tipo: 'sucesso',
        texto: `Ajuste realizado com sucesso! Sequência ${sequenciaAtual} → ${sequenciaCorreta}`,
      });
    } catch (error) {
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao processar o arquivo: ' + error.message,
      });
    } finally {
      setProcessando(false);
    }
  };

  const baixarArquivo = () => {
    if (!conteudoAjustado) {
      setMensagem({
        tipo: 'erro',
        texto: 'Nenhum ajuste foi realizado ainda',
      });
      return;
    }

    const blob = new Blob([conteudoAjustado], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Manter o nome original mas com extensão .ret
    const nomeOriginal = arquivo.name.replace(/\.(txt|ret)$/, '');
    link.download = `${nomeOriginal}_ajustado.ret`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setMensagem({
      tipo: 'sucesso',
      texto: 'Arquivo baixado com sucesso!',
    });
  };

  const limparTudo = () => {
    setArquivo(null);
    setConteudoOriginal('');
    setSequenciaAtual('');
    setSequenciaCorreta('');
    setConteudoAjustado('');
    setMensagem({ tipo: '', texto: '' });

    // Limpar o input file
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <PageTitle
          title="Ajuste de Arquivo .RET"
          subtitle="Ajuste a sequência (NSR) no sufixo das linhas do arquivo de retorno bancário"
          icon={FileText}
          color="text-[#000638]"
          iconColor="text-blue-600"
        />

        {/* Mensagem de feedback */}
        {mensagem.texto && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              mensagem.tipo === 'erro'
                ? 'bg-red-50 border border-red-200'
                : mensagem.tipo === 'sucesso'
                ? 'bg-green-50 border border-green-200'
                : mensagem.tipo === 'aviso'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-blue-50 border border-blue-200'
            }`}
          >
            {mensagem.tipo === 'sucesso' ? (
              <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
            ) : (
              <WarningCircle
                className={`flex-shrink-0 ${
                  mensagem.tipo === 'erro'
                    ? 'text-red-600'
                    : mensagem.tipo === 'aviso'
                    ? 'text-yellow-600'
                    : 'text-blue-600'
                }`}
                size={20}
              />
            )}
            <p
              className={`text-sm ${
                mensagem.tipo === 'erro'
                  ? 'text-red-800'
                  : mensagem.tipo === 'sucesso'
                  ? 'text-green-800'
                  : mensagem.tipo === 'aviso'
                  ? 'text-yellow-800'
                  : 'text-blue-800'
              }`}
            >
              {mensagem.texto}
            </p>
          </div>
        )}

        {/* Card principal */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Upload de arquivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1. Selecione o arquivo .txt ou .ret
            </label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="file-upload"
                className="flex items-center gap-2 px-4 py-2 bg-[#000638] text-white rounded-lg hover:bg-red-600 cursor-pointer transition-colors"
              >
                <Upload size={20} />
                Selecionar Arquivo
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".txt,.ret"
                onChange={handleFileUpload}
                className="hidden"
              />
              {arquivo && (
                <span className="text-sm text-gray-600">📄 {arquivo.name}</span>
              )}
            </div>
          </div>

          {/* Inputs de sequência */}
          {conteudoOriginal && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Sequência Atual (detectada)
                  </label>
                  <input
                    type="text"
                    value={sequenciaAtual}
                    onChange={(e) =>
                      setSequenciaAtual(e.target.value.slice(0, 3))
                    }
                    placeholder="Ex: 012"
                    maxLength="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formato completo: {sequenciaAtual || 'XXX'}000001
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    3. Sequência Correta
                  </label>
                  <input
                    type="text"
                    value={sequenciaCorreta}
                    onChange={(e) =>
                      setSequenciaCorreta(e.target.value.slice(0, 3))
                    }
                    placeholder="Ex: 015"
                    maxLength="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formato completo: {sequenciaCorreta || 'XXX'}000001
                  </p>
                </div>
              </div>

              {/* Botão de processar */}
              <div className="flex gap-4">
                <button
                  onClick={processarAjuste}
                  disabled={processando || !sequenciaCorreta}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {processando ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      4. Processar Ajuste
                    </>
                  )}
                </button>

                {conteudoAjustado && (
                  <button
                    onClick={baixarArquivo}
                    className="flex items-center gap-2 px-6 py-3 bg-[#000638] text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    <Download size={20} />
                    5. Baixar Arquivo .RET
                  </button>
                )}

                <button
                  onClick={limparTudo}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium ml-auto"
                >
                  Limpar Tudo
                </button>
              </div>
            </>
          )}
        </div>

        {/* Preview do resultado */}
        {conteudoAjustado && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Preview do Arquivo Ajustado
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs text-gray-800 whitespace-pre font-mono">
                {conteudoAjustado.split('\n').slice(0, 10).join('\n')}
                {conteudoAjustado.split('\n').length > 10 &&
                  '\n\n... (linhas restantes)'}
              </pre>
            </div>
          </div>
        )}

        {/* Removido bloco de instruções para layout mais limpo */}
      </div>
    </div>
  );
}
