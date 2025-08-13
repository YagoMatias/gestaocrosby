import React, { useState, useRef } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { 
  Upload, 
  FileText, 
  Bank, 
  CurrencyDollar, 
  Calendar,
  Spinner,
  CheckCircle,
  XCircle,
  Trash,
  FolderOpen,
  Database
} from '@phosphor-icons/react';
import { salvarRetornoBancario } from '../lib/retornoBancario';

const ImportacaoRet = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [savedFiles, setSavedFiles] = useState([]);
  const [duplicateFiles, setDuplicateFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = (files) => {
    const validFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      return fileName.endsWith('.ret');
    });

    if (validFiles.length === 0) {
      setError('Por favor, selecione apenas arquivos .RET');
      return;
    }

    if (selectedFiles.length + validFiles.length > 10) {
      setError('Máximo de 10 arquivos permitidos');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setError('');
    
    // Mostrar alert de confirmação após adicionar arquivos
    handleFilesAdded(validFiles);
  };

  const handleFilesAdded = (files) => {
    if (files.length > 0) {
      const confirmMessage = `Deseja importar ${files.length} arquivo(s) .RET para o banco de dados?`;
      if (window.confirm(confirmMessage)) {
        uploadFiles(files);
      } else {
        // Se o usuário cancelar, limpar os arquivos selecionados
        setSelectedFiles([]);
        setProgress(0);
        setResult(null);
        setError(null);
        setSavedFiles([]);
        setDuplicateFiles([]);
      }
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFiles = async (filesToUpload = null) => {
    const files = filesToUpload || selectedFiles;
    
    if (files.length === 0) {
      setError('Por favor, selecione pelo menos um arquivo');
      return;
    }

    if (files.length > 10) {
      setError('Máximo de 10 arquivos permitidos');
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    setIsLoading(true);
    setError('');
    setResult(null);
    setProgress(0);
    setSavedFiles([]);
    setDuplicateFiles([]);

    try {
      const response = await fetch('https://apigestaocrosby-bw2v.onrender.com/api/financial/upload-retorno-multiplo', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        const responseData = data.data || data;
        setResult(responseData);
        setProgress(50); // 50% após processar arquivos

        // Salvar dados no Supabase
        if (responseData.resultados && responseData.resultados.length > 0) {
          await salvarDadosNoSupabase(responseData.resultados);
        }

        setProgress(100);
      } else {
        setError(data.message || 'Erro ao processar arquivos');
      }
    } catch (error) {
      setError('Erro na comunicação com o servidor: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const salvarDadosNoSupabase = async (resultados) => {
    const arquivosSalvos = [];
    const arquivosDuplicados = [];

    for (const resultado of resultados) {
      try {
        const dadosParaSalvar = {
          nomeArquivo: resultado.arquivo.nomeOriginal,
          dataUpload: resultado.arquivo.dataUpload,
          valor: resultado.saldoAtual || parseFloat(resultado.saldoFormatado.replace(/[^\d.-]/g, '')),
          banco: resultado.banco,
          agencia: resultado.agencia,
          conta: resultado.conta,
          saldoFormatado: resultado.saldoFormatado,
          dataGeracao: resultado.dataGeracao
        };

        const resultadoSalvamento = await salvarRetornoBancario(dadosParaSalvar);

        if (resultadoSalvamento.success) {
          arquivosSalvos.push({
            nome: resultado.arquivo.nomeOriginal,
            mensagem: resultadoSalvamento.message
          });
        } else if (resultadoSalvamento.duplicate) {
          arquivosDuplicados.push({
            nome: resultado.arquivo.nomeOriginal,
            mensagem: resultadoSalvamento.message
          });
        } else {
          arquivosDuplicados.push({
            nome: resultado.arquivo.nomeOriginal,
            mensagem: resultadoSalvamento.message
          });
        }
      } catch (error) {
        console.error('Erro ao salvar arquivo:', resultado.arquivo.nomeOriginal, error);
        arquivosDuplicados.push({
          nome: resultado.arquivo.nomeOriginal,
          mensagem: 'Erro ao salvar no banco de dados: ' + error.message
        });
      }
    }

    setSavedFiles(arquivosSalvos);
    setDuplicateFiles(arquivosDuplicados);
  };

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-barlow flex items-center gap-3">
              <FileText size={32} className="text-blue-600" />
              Upload Múltiplo - Arquivos de Retorno Bancário
            </h1>
            <p className="text-gray-600 mt-2 font-barlow">
              Faça upload de múltiplos arquivos .RET do banco para processar e visualizar os dados.
            </p>
          </div>

          {/* Upload Area */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl rounded-xl bg-white mb-6">
            <CardContent className="p-8 mt-8">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
                  isDragOver
                    ? 'border-green-500 bg-green-50'
                    : 'border-blue-400 hover:border-blue-500 bg-blue-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleUploadClick}
              >
                <Upload size={48} className="mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2 font-barlow">
                  📁 Selecione múltiplos arquivos .RET
                </h3>
                <p className="text-lg font-medium text-gray-700 mb-4 font-barlow">
                  Arraste e solte os arquivos aqui ou clique para selecionar
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors font-barlow flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadClick();
                    }}
                  >
                    <FolderOpen size={20} />
                    Selecionar Arquivos
                  </button>

                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".RET,.ret,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {selectedFiles.length > 0 && (
            <Card className="shadow-lg rounded-xl bg-white mb-6">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-800 font-barlow">
                  📄 Arquivos Selecionados ({selectedFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <span className="text-gray-700 font-barlow">
                        📄 {file.name} ({formatFileSize(file.size)})
                      </span>
                      <button
                        onClick={() => removeFile(index)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Bar */}
          {isLoading && (
            <Card className="shadow-lg rounded-xl bg-white mb-6">
              <CardContent className="p-6">
                <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="text-center">
                  <Spinner size={32} className="mx-auto mb-2 text-blue-600 animate-spin" />
                  <p className="text-lg font-medium text-gray-700 font-barlow">
                    Processando arquivos... {progress}%
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Card className="shadow-lg rounded-xl bg-white mb-6 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <XCircle size={24} className="text-red-600" />
                  <h3 className="text-lg font-semibold text-red-800 font-barlow">❌ Erro</h3>
                </div>
                <p className="text-red-700 font-barlow">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Success Result */}
          {result && (
            <div className="space-y-6">
              {/* Summary */}
              <Card className="shadow-lg rounded-xl bg-white border-green-200">
                <CardContent className="p-6">
                  <div className="text-center">
                    <CheckCircle size={32} className="mx-auto mb-3 text-green-600" />
                    <h3 className="text-2xl font-bold text-green-800 mb-4 font-barlow">
                      📊 Resumo do Processamento
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 font-barlow">
                          {result.resumo?.totalArquivos || 0}
                        </div>
                        <div className="text-sm text-gray-600 font-barlow">Total de Arquivos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 font-barlow">
                          {result.resumo?.sucessos || 0}
                        </div>
                        <div className="text-sm text-gray-600 font-barlow">Sucessos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 font-barlow">
                          {result.resumo?.erros || 0}
                        </div>
                        <div className="text-sm text-gray-600 font-barlow">Erros</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600 font-barlow">
                          {result.resumo?.saldoTotalFormatado || 'R$ 0,00'}
                        </div>
                        <div className="text-sm text-gray-600 font-barlow">Saldo Total</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Results */}
              {(savedFiles.length > 0 || duplicateFiles.length > 0) && (
                <Card className="shadow-lg rounded-xl bg-white border-blue-200">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Database size={20} className="text-blue-600" />
                      <CardTitle className="text-lg font-bold text-blue-800 font-barlow">
                        💾 Resultados do Banco de Dados
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Arquivos Salvos */}
                    {savedFiles.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-green-700 mb-2 font-barlow">
                          ✅ Arquivos Salvos ({savedFiles.length})
                        </h4>
                        <div className="space-y-2">
                          {savedFiles.map((arquivo, index) => (
                            <div key={index} className="bg-green-50 p-3 rounded-lg">
                              <p className="font-semibold text-green-800 font-barlow">{arquivo.nome}</p>
                              <p className="text-green-700 font-barlow">{arquivo.mensagem}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Arquivos Duplicados/Com Erro */}
                    {duplicateFiles.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-orange-700 mb-2 font-barlow">
                          ⚠️ Arquivos Não Salvos ({duplicateFiles.length})
                        </h4>
                        <div className="space-y-2">
                          {duplicateFiles.map((arquivo, index) => (
                            <div key={index} className="bg-orange-50 p-3 rounded-lg">
                              <p className="font-semibold text-orange-800 font-barlow">{arquivo.nome}</p>
                              <p className="text-orange-700 font-barlow">{arquivo.mensagem}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Files with Errors */}
              {result.arquivosComErro && result.arquivosComErro.length > 0 && (
                <Card className="shadow-lg rounded-xl bg-white border-red-200">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-red-800 font-barlow">
                      ❌ Arquivos com Erro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.arquivosComErro.map((erro, index) => (
                        <div key={index} className="bg-red-50 p-3 rounded-lg">
                          <p className="font-semibold text-red-800 font-barlow">{erro.nome}</p>
                          <p className="text-red-700 font-barlow">{erro.erro}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bank Results */}
              {result.resultados && result.resultados.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {result.resultados.map((resultado, index) => (
                    <Card key={index} className="shadow-lg rounded-xl bg-white">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Bank size={20} className="text-blue-600" />
                          <CardTitle className="text-lg font-bold text-blue-700 font-barlow">
                            🏦 {resultado.banco.nome}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700 font-barlow">Código:</span>
                          <span className="text-gray-900 font-barlow">{resultado.banco.codigo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700 font-barlow">Layout:</span>
                          <span className="text-gray-900 font-barlow">{resultado.banco.layout}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700 font-barlow">🏛️ Agência:</span>
                          <span className="text-gray-900 font-barlow">{resultado.agencia}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700 font-barlow">📋 Conta:</span>
                          <span className="text-gray-900 font-barlow">{resultado.conta}</span>
                        </div>
                        <div className="text-center py-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600 font-barlow">
                            💰 {resultado.saldoFormatado}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 font-barlow">
                          <strong>Arquivo:</strong> {resultado.arquivo.nomeOriginal}
                        </div>
                                                 <div className="text-sm text-gray-600 font-barlow">
                           <strong>Processado em:</strong> {new Date(resultado.arquivo.dataUpload).toLocaleString('pt-BR')}
                         </div>
                         <div className="text-sm text-gray-600 font-barlow">
                           <strong>Data de Geração:</strong> {resultado.dataGeracao ? new Date(resultado.dataGeracao).toLocaleString('pt-BR') : 'N/A'}
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ImportacaoRet;
