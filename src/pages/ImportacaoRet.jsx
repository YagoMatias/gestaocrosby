import React, { useState, useRef } from 'react';
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [filesToConfirm, setFilesToConfirm] = useState([]);
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

    // Limite removido - agora permite qualquer quantidade de arquivos

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setError('');
    
    // Mostrar alert de confirmação após adicionar arquivos
    handleFilesAdded(validFiles);
  };

  const handleFilesAdded = (files) => {
    if (files.length > 0) {
      setFilesToConfirm(files);
      setShowConfirmModal(true);
    }
  };

  const handleConfirmUpload = () => {
    uploadFiles(filesToConfirm);
    setShowConfirmModal(false);
    setFilesToConfirm([]);
  };

  const handleCancelUpload = () => {
    // Se o usuário cancelar, limpar os arquivos selecionados
    setSelectedFiles([]);
    setProgress(0);
    setResult(null);
    setError(null);
    setSavedFiles([]);
    setDuplicateFiles([]);
    setShowConfirmModal(false);
    setFilesToConfirm([]);
  };

  // Fechar modal ao clicar fora ou pressionar ESC
  const handleModalClose = (e) => {
    if (e.target === e.currentTarget) {
      handleCancelUpload();
    }
  };

  // Adicionar listener para tecla ESC
  React.useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && showConfirmModal) {
        handleCancelUpload();
      }
    };

    if (showConfirmModal) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden'; // Prevenir scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [showConfirmModal]);

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

  // Função para determinar a cor baseada no valor do saldo
  const getSaldoColor = (saldoFormatado) => {
    if (!saldoFormatado) return 'text-gray-600';
    
    // Extrair o valor numérico do saldo formatado
    const valorNumerico = parseFloat(saldoFormatado.replace(/[^\d.-]/g, ''));
    
    if (valorNumerico > 0) return 'text-green-600';
    if (valorNumerico < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Função para determinar a cor de fundo baseada no valor do saldo
  const getSaldoBgColor = (saldoFormatado) => {
    if (!saldoFormatado) return 'bg-gray-50';
    
    // Extrair o valor numérico do saldo formatado
    const valorNumerico = parseFloat(saldoFormatado.replace(/[^\d.-]/g, ''));
    
    if (valorNumerico > 0) return 'bg-green-50';
    if (valorNumerico < 0) return 'bg-red-50';
    return 'bg-gray-50';
  };

  // Função para formatar número da conta (remover zeros à esquerda)
  const formatConta = (conta) => {
    if (!conta) return 'N/A';
    // Remove zeros à esquerda e converte para string
    return parseInt(conta, 10).toString();
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

    // Limite removido - agora permite qualquer quantidade de arquivos

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
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-barlow">
              Importação .RET
            </h1>
            <p className="text-gray-600 mt-2 font-barlow">
              Faça upload de arquivos .RET do banco para processar e visualizar os dados.
            </p>
          </div>

          {/* Upload Area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
              Upload de Arquivos
            </h2>
            
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
                isDragOver
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadClick}
            >
              <Upload size={48} className="mx-auto mb-4 text-gray-500" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2 font-barlow">
                Selecione arquivos .RET
              </h3>
              <p className="text-lg font-medium text-gray-700 mb-4 font-barlow">
                Arraste e solte os arquivos aqui ou clique para selecionar
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  className="bg-[#000638] hover:bg-[#000638]/90 text-white px-6 py-3 rounded-lg font-medium transition-colors font-barlow flex items-center gap-2"
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
          </div>

          {/* File List */}
          {selectedFiles.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                Arquivos Selecionados ({selectedFiles.length})
              </h2>
              
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-700 font-barlow">
                      {file.name} ({formatFileSize(file.size)})
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
            </div>
          )}

          {/* Progress Bar */}
          {isLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                Processando Arquivos
              </h2>
              
              <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <div 
                  className="bg-[#000638] h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-center">
                <Spinner size={32} className="mx-auto mb-2 text-[#000638] animate-spin" />
                <p className="text-lg font-medium text-gray-700 font-barlow">
                  Processando arquivos... {progress}%
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-8 text-center font-barlow">
              <div className="flex items-center justify-center gap-2 mb-2">
                <XCircle size={20} />
                <span className="font-semibold">Erro</span>
              </div>
              {error}
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-7xl mx-auto">
                {/* Total de Arquivos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={18} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-blue-700 font-barlow">Total de Arquivos</h3>
                  </div>
                  <div className="text-2xl font-extrabold text-blue-600 mb-1">
                    {result.resumo?.totalArquivos || 0}
                  </div>
                  <p className="text-xs text-gray-500 font-barlow">Arquivos processados</p>
                </div>

                {/* Sucessos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={18} className="text-green-600" />
                    <h3 className="text-sm font-bold text-green-700 font-barlow">Sucessos</h3>
                  </div>
                  <div className="text-2xl font-extrabold text-green-600 mb-1">
                    {result.resumo?.sucessos || 0}
                  </div>
                  <p className="text-xs text-gray-500 font-barlow">Arquivos processados com sucesso</p>
                </div>

                {/* Erros */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle size={18} className="text-red-600" />
                    <h3 className="text-sm font-bold text-red-700 font-barlow">Erros</h3>
                  </div>
                  <div className="text-2xl font-extrabold text-red-600 mb-1">
                    {result.resumo?.erros || 0}
                  </div>
                  <p className="text-xs text-gray-500 font-barlow">Arquivos com erro</p>
                </div>

                {/* Saldo Total */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CurrencyDollar size={18} className="text-purple-600" />
                    <h3 className="text-sm font-bold text-purple-700 font-barlow">Saldo Total</h3>
                  </div>
                  <div className={`text-lg font-extrabold mb-1 break-words ${getSaldoColor(result.resumo?.saldoTotalFormatado)}`}>
                    {result.resumo?.saldoTotalFormatado || 'R$ 0,00'}
                  </div>
                  <p className="text-xs text-gray-500 font-barlow">Valor total processado</p>
                </div>
              </div>

              {/* Database Results */}
              {(savedFiles.length > 0 || duplicateFiles.length > 0) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                    Resultados do Banco de Dados
                  </h2>
                  
                  <div className="space-y-4">
                    {/* Arquivos Salvos */}
                    {savedFiles.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-green-700 mb-2 font-barlow">
                          Arquivos Salvos ({savedFiles.length})
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
                          Arquivos Não Salvos ({duplicateFiles.length})
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
                  </div>
                </div>
              )}

              {/* Files with Errors */}
              {result.arquivosComErro && result.arquivosComErro.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                    Arquivos com Erro
                  </h2>
                  
                  <div className="space-y-2">
                    {result.arquivosComErro.map((erro, index) => (
                      <div key={index} className="bg-red-50 p-3 rounded-lg">
                        <p className="font-semibold text-red-800 font-barlow">{erro.nome}</p>
                        <p className="text-red-700 font-barlow">{erro.erro}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Results */}
              {result.resultados && result.resultados.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                    Resultados dos Bancos
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {result.resultados.map((resultado, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Bank size={20} className="text-[#000638]" />
                          <h3 className="text-lg font-bold text-[#000638] font-barlow">
                            {resultado.banco.nome}
                          </h3>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700 font-barlow">Código:</span>
                            <span className="text-gray-900 font-barlow">{resultado.banco.codigo}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700 font-barlow">Layout:</span>
                            <span className="text-gray-900 font-barlow">{resultado.banco.layout}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700 font-barlow">Agência:</span>
                            <span className="text-gray-900 font-barlow">{resultado.agencia}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700 font-barlow">Conta:</span>
                            <span className="text-gray-900 font-barlow">{formatConta(resultado.conta)}</span>
                          </div>
                        </div>
                        
                        <div className={`text-center py-3 rounded-lg mt-3 ${getSaldoBgColor(resultado.saldoFormatado)}`}>
                          <div className={`text-xl font-bold font-barlow ${getSaldoColor(resultado.saldoFormatado)}`}>
                            {resultado.saldoFormatado}
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600 font-barlow mt-3 space-y-1">
                          <div><strong>Arquivo:</strong> {resultado.arquivo.nomeOriginal}</div>
                          <div><strong>Processado em:</strong> {new Date(resultado.arquivo.dataUpload).toLocaleString('pt-BR')}</div>
                          <div><strong>Data de Geração:</strong> {resultado.dataGeracao ? new Date(resultado.dataGeracao).toLocaleString('pt-BR') : 'N/A'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal de Confirmação */}
          {showConfirmModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
              onClick={handleModalClose}
            >
              <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
                {/* Botão de fechar */}
                <button
                  onClick={handleCancelUpload}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle size={24} />
                </button>
                
                <div className="text-center mb-6">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <FileText size={32} className="text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 font-barlow">
                    Confirmar Importação
                  </h3>
                  <p className="text-gray-600 font-barlow">
                    Deseja importar <strong>{filesToConfirm.length}</strong> arquivo(s) .RET para o banco de dados?
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-32 overflow-y-auto">
                  <h4 className="font-semibold text-gray-900 mb-2 font-barlow text-sm">
                    Arquivos selecionados:
                  </h4>
                  <div className="space-y-1">
                    {filesToConfirm.map((file, index) => (
                      <div key={index} className="text-sm text-gray-600 font-barlow flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        {file.name} ({formatFileSize(file.size)})
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCancelUpload}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors font-barlow"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    className="flex-1 px-4 py-3 bg-[#000638] hover:bg-[#000638]/90 text-white rounded-lg font-medium transition-colors font-barlow"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};

export default ImportacaoRet;
