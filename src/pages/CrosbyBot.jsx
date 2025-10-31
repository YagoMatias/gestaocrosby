import React, { useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import {
  Robot,
  Plus,
  ChatText,
  Microphone,
  Image,
  VideoCamera,
  FilePdf,
  Trash,
  TextAlignLeft,
  TextB,
  TextItalic,
  TextT,
  DotsSixVertical,
  PencilSimple,
  ArrowUp,
  ArrowDown,
  Eye,
  X,
  PaperPlaneTilt,
  Check,
  Checks,
  UploadSimple,
  Users,
  FileXls,
} from '@phosphor-icons/react';

const CrosbyBot = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editFormatting, setEditFormatting] = useState({
    bold: false,
    italic: false,
    uppercase: false,
    lowercase: false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [contatos, setContatos] = useState([]);
  const [showContatosModal, setShowContatosModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Tipos de mensagem disponíveis
  const messageTypes = [
    { type: 'text', label: 'Texto', icon: ChatText, color: 'bg-blue-500' },
    {
      type: 'audio',
      label: 'Áudio',
      icon: Microphone,
      color: 'bg-green-500',
    },
    { type: 'image', label: 'Foto', icon: Image, color: 'bg-purple-500' },
    { type: 'video', label: 'Vídeo', icon: VideoCamera, color: 'bg-red-500' },
    // { type: 'pdf', label: 'PDF', icon: FilePdf, color: 'bg-orange-500' },
  ];

  // Adicionar nova mensagem
  const addMessage = (type) => {
    const newMessage = {
      id: Date.now(),
      type,
      content: type === 'text' ? [''] : null, // Array de mensagens para texto
      file: null,
      formatting: {
        bold: false,
        italic: false,
        uppercase: false,
        lowercase: false,
      },
    };
    setMessages([...messages, newMessage]);
    setSelectedMessage(newMessage.id);
    setEditContent(['']); // Iniciar com array vazio
    setEditFormatting({
      bold: false,
      italic: false,
      uppercase: false,
      lowercase: false,
    });
  };

  // Deletar mensagem
  const deleteMessage = (id) => {
    setMessages(messages.filter((msg) => msg.id !== id));
    if (selectedMessage === id) {
      setSelectedMessage(null);
    }
  };

  // Selecionar mensagem para edição
  const selectMessage = (msg) => {
    setSelectedMessage(msg.id);
    // Se for texto, garantir que seja array
    if (msg.type === 'text') {
      setEditContent(
        Array.isArray(msg.content) ? msg.content : [msg.content || ''],
      );
    } else {
      setEditContent(msg.content || '');
    }
    setEditFormatting(msg.formatting);
  };

  // Salvar edição
  const saveEdit = () => {
    setMessages(
      messages.map((msg) =>
        msg.id === selectedMessage
          ? { ...msg, content: editContent, formatting: editFormatting }
          : msg,
      ),
    );
  };

  // Mover mensagem para cima
  const moveUp = (index) => {
    if (index === 0) return;
    const newMessages = [...messages];
    [newMessages[index - 1], newMessages[index]] = [
      newMessages[index],
      newMessages[index - 1],
    ];
    setMessages(newMessages);
  };

  // Mover mensagem para baixo
  const moveDown = (index) => {
    if (index === messages.length - 1) return;
    const newMessages = [...messages];
    [newMessages[index], newMessages[index + 1]] = [
      newMessages[index + 1],
      newMessages[index],
    ];
    setMessages(newMessages);
  };

  // Aplicar formatação ao texto
  const applyFormatting = (text, formatting) => {
    let result = text;
    if (formatting.uppercase) result = result.toUpperCase();
    if (formatting.lowercase) result = result.toLowerCase();
    return result;
  };

  // Renderizar preview do texto com formatação
  const renderTextPreview = (msg) => {
    const contentArray = Array.isArray(msg.content)
      ? msg.content
      : [msg.content || ''];
    const validTexts = contentArray.filter((t) => t && t.trim());

    if (validTexts.length === 0) {
      return <span className="text-gray-400 italic">Texto vazio...</span>;
    }

    const firstText = applyFormatting(validTexts[0], msg.formatting);
    const className = `${msg.formatting.bold ? 'font-bold' : ''} ${
      msg.formatting.italic ? 'italic' : ''
    }`;

    return (
      <span className={className}>
        {firstText}
        {validTexts.length > 1 && (
          <span className="ml-2 text-xs text-indigo-600 font-semibold">
            +{validTexts.length - 1} variações
          </span>
        )}
      </span>
    );
  };

  // Obter ícone e cor do tipo
  const getTypeInfo = (type) => {
    return messageTypes.find((t) => t.type === type);
  };

  // Upload de arquivo
  const handleFileUpload = (e, messageId) => {
    const file = e.target.files[0];
    if (file) {
      setMessages(
        messages.map((msg) =>
          msg.id === messageId ? { ...msg, file, content: file.name } : msg,
        ),
      );
    }
  };

  // Função para importar contatos via Excel
  const handleImportarContatos = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Verificar se é um arquivo Excel
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(xlsx?|csv)$/i)
    ) {
      alert('❌ Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV');
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;

        // Para arquivos CSV
        if (file.name.endsWith('.csv')) {
          const lines = data.split('\n');
          const contatosImportados = [];

          // Ignorar primeira linha (cabeçalho)
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Separar por vírgula ou ponto-e-vírgula
            const columns = line.split(/[;,]/);

            if (columns.length >= 2) {
              // Remover apóstrofo inicial (') que o Excel usa para forçar texto
              let telefone = columns[0].trim();
              if (telefone.startsWith("'")) {
                telefone = telefone.substring(1);
              }

              const nome = columns[1].trim();

              if (telefone && nome) {
                contatosImportados.push({
                  id: Date.now() + i,
                  telefone,
                  nome,
                });
              }
            }
          }

          if (contatosImportados.length > 0) {
            setContatos((prev) => [...prev, ...contatosImportados]);
            alert(
              `✅ ${contatosImportados.length} contatos importados com sucesso!`,
            );
          } else {
            alert('❌ Nenhum contato válido encontrado no arquivo');
          }
        } else {
          // Para arquivos Excel, precisamos de uma biblioteca
          alert(
            '📝 Para arquivos Excel (.xlsx), use um arquivo CSV ou instale a biblioteca xlsx',
          );
          alert(
            '💡 Dica: No Excel, vá em "Salvar Como" → "CSV (delimitado por vírgulas)"',
          );
        }
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        alert('❌ Erro ao processar arquivo. Verifique o formato.');
      }
    };

    // Ler como texto para CSV ou como array buffer para Excel
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    // Limpar input
    e.target.value = '';
  };

  // Função para remover contato
  const removerContato = (id) => {
    setContatos(contatos.filter((c) => c.id !== id));
  };

  // Função para limpar todos os contatos
  const limparContatos = () => {
    if (contatos.length === 0) return;
    if (confirm(`Deseja remover todos os ${contatos.length} contatos?`)) {
      setContatos([]);
    }
  };

  // Função para determinar a URL da API baseada no tipo de mensagem
  const getApiUrl = (type, content, file) => {
    if (type === 'text') {
      // Texto com até 600 caracteres
      if (content && content.length <= 600) {
        return 'https://msgapi.crosbytech.com.br/message/sendText/';
      }
    } else if (type === 'image') {
      // Imagem (jpeg)
      if (file && file.type.includes('image')) {
        return 'https://msgapi.crosbytech.com.br/message/sendMedia/';
      }
    } else if (type === 'audio') {
      // Áudio (ogg)
      if (file && (file.type.includes('audio') || file.name.endsWith('.ogg'))) {
        return 'https://msgapi.crosbytech.com.br/message/sendWhatsAppAudio/';
      }
    } else if (type === 'video') {
      // Vídeo
      if (file && file.type.includes('video')) {
        return 'https://msgapi.crosbytech.com.br/message/sendMedia/';
      }
    } else if (type === 'pdf') {
      // PDF
      if (file && file.type.includes('pdf')) {
        return 'https://msgapi.crosbytech.com.br/message/sendMedia/';
      }
    }
    return null;
  };

  // Função para fazer upload de mídia no Supabase Storage
  // Baseado em endividamentoApi.js
  const uploadMidia = async (file, messageId) => {
    if (!file) return null;

    const BUCKET_NAME = 'midias_bot';

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Gerar nome único para o arquivo (mesmo método do endividamentoApi.js)
      const uid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());

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
      const path = `${folder}/${user.id}/${uid}_${file.name}`;

      console.log(`📤 Fazendo upload de ${file.name} para ${path}...`);

      // Fazer upload para o Storage (método idêntico ao endividamentoApi.js)
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: false });

      if (error) {
        // Tratamento de erro similar ao endividamentoApi.js
        if (
          String(error.message || '')
            .toLowerCase()
            .includes('bucket') &&
          String(error.message || '')
            .toLowerCase()
            .includes('not') &&
          String(error.message || '')
            .toLowerCase()
            .includes('found')
        ) {
          throw new Error(
            `Bucket "${BUCKET_NAME}" não encontrado. Crie o bucket no Storage do Supabase (público) ou altere o nome no código.`,
          );
        }
        throw error;
      }

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);

      console.log(
        `✅ Mídia ${file.name} enviada com sucesso: ${urlData.publicUrl}`,
      );
      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Erro ao fazer upload da mídia:', error);
      throw error;
    }
  };

  // Função para enviar mensagens para o Supabase
  const handleSendMessages = async () => {
    if (!user || !user.id) {
      alert('❌ Erro: Usuário não autenticado!');
      return;
    }

    if (messages.length === 0) {
      alert('❌ Adicione pelo menos uma mensagem antes de enviar!');
      return;
    }

    if (contatos.length === 0) {
      alert('❌ Importe pelo menos um contato antes de enviar!');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress('Preparando upload...');

      // Etapa 1: Fazer upload das mídias primeiro
      console.log('📤 Iniciando upload de mídias...');

      const totalMidias = messages.filter(
        (m) => m.file && m.type !== 'text',
      ).length;
      let midiaAtual = 0;

      const messagesComMidia = await Promise.all(
        messages.map(async (msg, index) => {
          let midiaInfo = null;

          // Se a mensagem tem arquivo (não é texto), fazer upload
          if (msg.file && msg.type !== 'text') {
            try {
              midiaAtual++;
              setUploadProgress(
                `Enviando mídia ${midiaAtual} de ${totalMidias}...`,
              );

              midiaInfo = await uploadMidia(msg.file, msg.id);
              console.log(`✅ Mídia ${index + 1} enviada:`, midiaInfo);
            } catch (error) {
              console.error(`❌ Erro ao enviar mídia ${index + 1}:`, error);
              setIsUploading(false);
              throw new Error(`Falha ao enviar mídia: ${msg.file.name}`);
            }
          }

          return { ...msg, midiaInfo };
        }),
      );

      console.log('✅ Todas as mídias foram enviadas!');
      setUploadProgress('Salvando no banco de dados...');

      // Etapa 2: Preparar array de mensagens com URLs das mídias
      const messagesPayload = messagesComMidia.map((msg, index) => {
        let value = '';

        if (msg.type === 'text') {
          // Para texto, aplicar formatação em cada variação e enviar como array
          const contentArray = Array.isArray(msg.content)
            ? msg.content
            : [msg.content || ''];
          const validTexts = contentArray.filter((t) => t && t.trim());

          // Aplicar formatação em todas as variações válidas
          value = validTexts.map((text) =>
            applyFormatting(text, msg.formatting),
          );

          // Se não houver textos válidos, enviar array com string vazia
          if (value.length === 0) {
            value = [''];
          }
        } else if (msg.midiaInfo) {
          // Para mídias, usar a URL pública (agora midiaInfo já é a URL)
          value = msg.midiaInfo;
        } else {
          value = 'Sem conteúdo';
        }

        const apiUrl = getApiUrl(msg.type, msg.content, msg.file);

        return {
          id: index + 1,
          type: apiUrl || 'URL não definida',
          value: value, // Agora value é array para mensagens de texto
        };
      });

      // Etapa 3: Preparar dados para inserção
      // Criar uma linha para CADA contato (não um JSON)
      const registrosParaInserir = contatos.map((contato) => ({
        tp_mensagem: messagesPayload,
        nr_contato: contato.telefone,
        nm_nome: contato.nome, // Nome como VARCHAR
        cd_user: user.id,
      }));

      console.log('📤 Enviando registros para banco:', registrosParaInserir);

      // Etapa 4: Inserir múltiplas linhas no Supabase (uma por contato)
      const { data, error } = await supabase
        .from('envio_em_massa')
        .insert(registrosParaInserir)
        .select();

      if (error) {
        console.error('❌ Erro ao salvar no Supabase:', error);
        setIsUploading(false);
        setUploadProgress('');
        alert(`❌ Erro ao enviar: ${error.message}`);
        return;
      }

      console.log('✅ Mensagens salvas com sucesso:', data);
      setIsUploading(false);
      setUploadProgress('');
      alert(
        `✅ Fluxo enviado com sucesso para ${contatos.length} contatos! 🚀`,
      );

      // Limpar mensagens e contatos após envio bem-sucedido
      setMessages([]);
      setContatos([]);
      setSelectedMessage(null);
      setShowPreview(false);
    } catch (error) {
      console.error('❌ Erro ao enviar mensagens:', error);
      setIsUploading(false);
      setUploadProgress('');
      alert(`❌ Erro ao enviar: ${error.message}`);
    }
  };

  // Função para baixar o CSV de exemplo
  const downloadExemploCSV = () => {
    // Usando apóstrofo (') antes dos números para forçar Excel a tratar como texto
    const csvContent =
      "telefone;nome\n'11999887766660;João Silva\n'11988776655;Maria Santos\n'11977665544;Pedro Oliveira";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'exemplo_para_envio_em_massa.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 h-full flex flex-col">
        <PageTitle
          title="Crosby Bot - WhatsApp"
          subtitle="Crie fluxos de mensagens automatizadas para WhatsApp"
          icon={Robot}
          iconColor="text-indigo-600"
        />

        <div className="flex-1 grid grid-cols-12 gap-6 mt-6 min-h-0">
          {/* Painel de Botões - Adicionar Mensagens */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg p-4 sticky top-4">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" />
                Adicionar Mensagem
              </h3>
              <div className="space-y-2">
                {messageTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.type}
                      onClick={() => addMessage(type.type)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 hover:scale-105 text-white shadow-md ${type.color}`}
                    >
                      <Icon size={20} weight="fill" />
                      <span className="font-semibold text-sm">
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Contador de mensagens */}
              <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 text-center">
                  <span className="font-bold text-indigo-600 text-lg">
                    {messages.length}
                  </span>{' '}
                  mensagem{messages.length !== 1 ? 's' : ''} no fluxo
                </p>
              </div>

              {/* Botão Preview */}
              {messages.length > 0 && (
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm shadow-md transition-all duration-200 hover:scale-105"
                >
                  <Eye size={20} weight="fill" />
                  Visualizar Preview
                </button>
              )}

              {/* Seção de Contatos */}
              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" />
                    Contatos
                    <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px]">
                      {contatos.length}
                    </span>
                  </h4>
                  {contatos.length > 0 && (
                    <button
                      onClick={limparContatos}
                      className="text-[10px] text-red-600 hover:text-red-700 font-semibold"
                    >
                      Limpar Todos
                    </button>
                  )}
                </div>

                {/* Botão Importar */}
                <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-md transition-all duration-200 hover:scale-105 cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportarContatos}
                    className="hidden"
                  />
                  <FileXls size={18} weight="fill" />
                  Importar CSV
                </label>

                {/* Instruções */}
                <div className="mt-2 p-2 bg-white rounded text-[10px] text-gray-600">
                  <p className="font-semibold text-gray-800 mb-1">
                    📋 Formato do arquivo:
                  </p>
                  <p className="ml-2">
                    • Coluna A: <strong>telefone</strong> (ex: '11999887766)
                  </p>
                  <p className="ml-2">
                    • Coluna B: <strong>nome</strong> (ex: João Silva)
                  </p>
                  <p className="mt-1 text-orange-600 font-semibold">
                    ⚠️ No Excel, coloque <strong>'</strong> antes do telefone!
                  </p>
                  <p className="mt-1 text-indigo-600">💡 Aceita arquivos CSV</p>
                </div>

                {/* Botão Download Exemplo */}
                <button
                  onClick={downloadExemploCSV}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-xs shadow-md transition-all duration-200 hover:scale-105"
                >
                  <FileXls size={16} weight="fill" />
                  Baixar CSV de Exemplo
                </button>

                {/* Lista de Contatos */}
                {contatos.length > 0 && (
                  <div className="mt-3 max-h-32 overflow-y-auto space-y-1">
                    {contatos.slice(0, 5).map((contato) => (
                      <div
                        key={contato.id}
                        className="flex items-center justify-between p-2 bg-white rounded text-[10px] group hover:bg-indigo-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">
                            {contato.nome}
                          </p>
                          <p className="text-gray-500 truncate">
                            {contato.telefone}
                          </p>
                        </div>
                        <button
                          onClick={() => removerContato(contato.id)}
                          className="ml-2 p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                    {contatos.length > 5 && (
                      <button
                        onClick={() => setShowContatosModal(true)}
                        className="w-full text-center text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold py-1"
                      >
                        Ver todos ({contatos.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tree View - Lista de Mensagens */}
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TextAlignLeft size={18} className="text-indigo-600" />
                Fluxo de Mensagens
              </h3>

              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Robot size={64} className="mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      Nenhuma mensagem adicionada ainda.
                    </p>
                    <p className="text-xs mt-2">
                      Clique nos botões ao lado para começar.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {messages.map((msg, index) => {
                    const typeInfo = getTypeInfo(msg.type);
                    const Icon = typeInfo.icon;
                    const isSelected = selectedMessage === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={`group relative p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow'
                        }`}
                        onClick={() => selectMessage(msg)}
                      >
                        {/* Grip para drag (visual) */}
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DotsSixVertical
                            size={16}
                            className="text-gray-400"
                          />
                        </div>

                        {/* Header com tipo e ações */}
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-8 h-8 rounded-full ${typeInfo.color} flex items-center justify-center`}
                          >
                            <Icon
                              size={16}
                              weight="fill"
                              className="text-white"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-700">
                              {typeInfo.label} #{index + 1}
                            </p>
                          </div>

                          {/* Botões de ação */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveUp(index);
                              }}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Mover para cima"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveDown(index);
                              }}
                              disabled={index === messages.length - 1}
                              className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Mover para baixo"
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMessage(msg.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Deletar"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Preview do conteúdo */}
                        <div className="ml-11 text-sm text-gray-600">
                          {msg.type === 'text' ? (
                            <p className="truncate">{renderTextPreview(msg)}</p>
                          ) : (
                            <p className="text-xs italic">
                              {msg.file
                                ? `📎 ${msg.file.name}`
                                : 'Nenhum arquivo anexado'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Painel de Edição */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PencilSimple size={18} className="text-indigo-600" />
                Editor
              </h3>

              {!selectedMessage ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <PencilSimple
                      size={48}
                      className="mx-auto mb-3 opacity-50"
                    />
                    <p className="text-sm">
                      Selecione uma mensagem para editar
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-4">
                  {messages.find((m) => m.id === selectedMessage)?.type ===
                  'text' ? (
                    <>
                      {/* Editor de texto com múltiplas variações */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-700">
                            Variações da Mensagem (
                            {Array.isArray(editContent)
                              ? editContent.filter((t) => t && t.trim()).length
                              : 0}
                            /10)
                          </label>
                          {Array.isArray(editContent) &&
                            editContent.length < 10 && (
                              <button
                                onClick={() => {
                                  const newContent = [...editContent, ''];
                                  setEditContent(newContent);
                                  setMessages(
                                    messages.map((msg) =>
                                      msg.id === selectedMessage
                                        ? { ...msg, content: newContent }
                                        : msg,
                                    ),
                                  );
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition-colors"
                              >
                                <Plus size={14} weight="bold" />
                                Adicionar Variação
                              </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {Array.isArray(editContent) &&
                            editContent.map((text, index) => (
                              <div key={index} className="relative">
                                <div className="flex items-start gap-2 mb-1">
                                  <span className="text-xs font-bold text-indigo-600 mt-2">
                                    #{index + 1}
                                  </span>
                                  {editContent.length > 1 && (
                                    <button
                                      onClick={() => {
                                        const newContent = editContent.filter(
                                          (_, i) => i !== index,
                                        );
                                        setEditContent(newContent);
                                        setMessages(
                                          messages.map((msg) =>
                                            msg.id === selectedMessage
                                              ? { ...msg, content: newContent }
                                              : msg,
                                          ),
                                        );
                                      }}
                                      className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded"
                                      title="Remover variação"
                                    >
                                      <Trash size={14} />
                                    </button>
                                  )}
                                </div>
                                <textarea
                                  value={text}
                                  onChange={(e) => {
                                    const newContent = [...editContent];
                                    newContent[index] = e.target.value;
                                    setEditContent(newContent);
                                  }}
                                  onBlur={() => {
                                    setMessages(
                                      messages.map((msg) =>
                                        msg.id === selectedMessage
                                          ? { ...msg, content: editContent }
                                          : msg,
                                      ),
                                    );
                                  }}
                                  placeholder={`Digite a variação ${
                                    index + 1
                                  } da mensagem...`}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                                  rows={3}
                                />
                              </div>
                            ))}
                        </div>

                        {Array.isArray(editContent) &&
                          editContent.length >= 10 && (
                            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                              ⚠️ Limite máximo de 10 variações atingido
                            </div>
                          )}
                      </div>

                      {/* Botões de formatação */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">
                          Formatação
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              const newFormatting = {
                                ...editFormatting,
                                bold: !editFormatting.bold,
                              };
                              setEditFormatting(newFormatting);
                              setMessages(
                                messages.map((msg) =>
                                  msg.id === selectedMessage
                                    ? { ...msg, formatting: newFormatting }
                                    : msg,
                                ),
                              );
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                              editFormatting.bold
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <TextB size={18} weight="bold" />
                            <span className="text-xs font-semibold">
                              Negrito
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              const newFormatting = {
                                ...editFormatting,
                                italic: !editFormatting.italic,
                              };
                              setEditFormatting(newFormatting);
                              setMessages(
                                messages.map((msg) =>
                                  msg.id === selectedMessage
                                    ? { ...msg, formatting: newFormatting }
                                    : msg,
                                ),
                              );
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                              editFormatting.italic
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <TextItalic size={18} />
                            <span className="text-xs font-semibold">
                              Itálico
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              const newFormatting = {
                                ...editFormatting,
                                uppercase: !editFormatting.uppercase,
                                lowercase: false,
                              };
                              setEditFormatting(newFormatting);
                              setMessages(
                                messages.map((msg) =>
                                  msg.id === selectedMessage
                                    ? { ...msg, formatting: newFormatting }
                                    : msg,
                                ),
                              );
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                              editFormatting.uppercase
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <TextT size={18} />
                            <span className="text-xs font-semibold">
                              MAIÚSC.
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              const newFormatting = {
                                ...editFormatting,
                                lowercase: !editFormatting.lowercase,
                                uppercase: false,
                              };
                              setEditFormatting(newFormatting);
                              setMessages(
                                messages.map((msg) =>
                                  msg.id === selectedMessage
                                    ? { ...msg, formatting: newFormatting }
                                    : msg,
                                ),
                              );
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                              editFormatting.lowercase
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <TextT size={18} />
                            <span className="text-xs font-semibold">
                              minúsc.
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Preview de todas as variações */}
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-600 mb-2">
                          Preview das Variações:
                        </p>
                        <div className="space-y-2">
                          {Array.isArray(editContent) &&
                            editContent.map((text, index) => {
                              if (!text || !text.trim()) return null;
                              const formattedText = applyFormatting(
                                text,
                                editFormatting,
                              );
                              const className = `${
                                editFormatting.bold ? 'font-bold' : ''
                              } ${editFormatting.italic ? 'italic' : ''}`;
                              return (
                                <div key={index} className="flex gap-2">
                                  <span className="text-xs font-bold text-indigo-600 flex-shrink-0">
                                    #{index + 1}
                                  </span>
                                  <p
                                    className={`text-sm text-gray-800 flex-1 ${className}`}
                                  >
                                    {formattedText}
                                  </p>
                                </div>
                              );
                            })}
                          {Array.isArray(editContent) &&
                            editContent.filter((t) => t && t.trim()).length ===
                              0 && (
                              <p className="text-sm text-gray-400 italic">
                                Nenhuma mensagem adicionada
                              </p>
                            )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Upload de arquivo para outros tipos */}
                      <div className="flex-1 flex flex-col">
                        <label className="text-xs font-semibold text-gray-700 mb-2">
                          Arquivo
                        </label>
                        <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-indigo-400 transition-colors">
                          <input
                            type="file"
                            id={`file-${selectedMessage}`}
                            className="hidden"
                            accept={
                              messages.find((m) => m.id === selectedMessage)
                                ?.type === 'audio'
                                ? 'audio/*'
                                : messages.find((m) => m.id === selectedMessage)
                                    ?.type === 'video'
                                ? 'video/*'
                                : messages.find((m) => m.id === selectedMessage)
                                    ?.type === 'image'
                                ? 'image/*'
                                : '.pdf'
                            }
                            onChange={(e) =>
                              handleFileUpload(e, selectedMessage)
                            }
                          />
                          <label
                            htmlFor={`file-${selectedMessage}`}
                            className="cursor-pointer text-center"
                          >
                            {messages.find((m) => m.id === selectedMessage)
                              ?.file ? (
                              <>
                                <div className="w-16 h-16 mx-auto mb-3 bg-indigo-100 rounded-full flex items-center justify-center">
                                  {React.createElement(
                                    getTypeInfo(
                                      messages.find(
                                        (m) => m.id === selectedMessage,
                                      )?.type,
                                    ).icon,
                                    { size: 32, className: 'text-indigo-600' },
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-gray-700 mb-1">
                                  {
                                    messages.find(
                                      (m) => m.id === selectedMessage,
                                    )?.file.name
                                  }
                                </p>
                                <p className="text-xs text-indigo-600 hover:text-indigo-700">
                                  Clique para alterar
                                </p>
                              </>
                            ) : (
                              <>
                                <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                                  <Plus size={32} className="text-gray-400" />
                                </div>
                                <p className="text-sm font-semibold text-gray-700 mb-1">
                                  Clique para adicionar arquivo
                                </p>
                                <p className="text-xs text-gray-500">
                                  {messages.find(
                                    (m) => m.id === selectedMessage,
                                  )?.type === 'audio'
                                    ? 'Formatos: MP3, WAV, OGG'
                                    : messages.find(
                                        (m) => m.id === selectedMessage,
                                      )?.type === 'video'
                                    ? 'Formatos: MP4, AVI, MOV'
                                    : messages.find(
                                        (m) => m.id === selectedMessage,
                                      )?.type === 'image'
                                    ? 'Formatos: JPG, PNG, GIF'
                                    : 'Formato: PDF'}
                                </p>
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Preview WhatsApp */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
              {/* Header do Modal */}
              <div className="bg-green-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <Robot size={24} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Crosby Bot</h3>
                    <p className="text-xs opacity-90">online</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-green-700 rounded-full transition-colors"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              {/* Chat Background (típico do WhatsApp) */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundColor: '#e5ddd5',
                }}
              >
                {messages.map((msg, index) => {
                  const Icon = getTypeInfo(msg.type).icon;
                  const hasFile = msg.file;
                  const formattedText =
                    msg.type === 'text'
                      ? applyFormatting(msg.content || '', msg.formatting)
                      : '';

                  return (
                    <div
                      key={msg.id}
                      className="flex items-end gap-2 animate-in slide-in-from-bottom-2 duration-300"
                    >
                      {/* Bubble da mensagem */}
                      <div className="bg-white rounded-lg shadow-md max-w-[75%] overflow-hidden">
                        {/* Conteúdo por tipo */}
                        {msg.type === 'text' ? (
                          <div className="px-3 py-2">
                            {Array.isArray(msg.content) ? (
                              <div className="space-y-2">
                                {msg.content
                                  .filter((t) => t && t.trim())
                                  .map((text, idx) => {
                                    const formatted = applyFormatting(
                                      text,
                                      msg.formatting,
                                    );
                                    return (
                                      <div key={idx} className="flex gap-2">
                                        <span className="text-[10px] font-bold text-indigo-600 flex-shrink-0 mt-0.5">
                                          #{idx + 1}
                                        </span>
                                        <p
                                          className={`text-sm text-gray-800 break-words flex-1 ${
                                            msg.formatting.bold
                                              ? 'font-bold'
                                              : ''
                                          } ${
                                            msg.formatting.italic
                                              ? 'italic'
                                              : ''
                                          }`}
                                        >
                                          {formatted}
                                        </p>
                                      </div>
                                    );
                                  })}
                                {msg.content.filter((t) => t && t.trim())
                                  .length === 0 && (
                                  <span className="text-gray-400 italic">
                                    Mensagem vazia
                                  </span>
                                )}
                                {msg.content.filter((t) => t && t.trim())
                                  .length > 1 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <p className="text-[10px] text-indigo-600 font-semibold">
                                      🔀 Uma variação aleatória será enviada
                                      para cada contato
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p
                                className={`text-sm text-gray-800 break-words ${
                                  msg.formatting.bold ? 'font-bold' : ''
                                } ${msg.formatting.italic ? 'italic' : ''}`}
                              >
                                {formattedText || (
                                  <span className="text-gray-400 italic">
                                    Mensagem vazia
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        ) : msg.type === 'image' ? (
                          <div className="relative">
                            <div className="bg-gray-200 aspect-square w-48 flex items-center justify-center">
                              {hasFile ? (
                                <div className="text-center">
                                  <Image
                                    size={48}
                                    className="text-gray-400 mx-auto mb-2"
                                  />
                                  <p className="text-xs text-gray-600 px-2">
                                    {msg.file.name}
                                  </p>
                                </div>
                              ) : (
                                <Image size={64} className="text-gray-400" />
                              )}
                            </div>
                            {hasFile && (
                              <div className="px-3 py-2 bg-white">
                                <p className="text-xs text-gray-600">
                                  📎 {msg.file.name}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : msg.type === 'video' ? (
                          <div className="relative">
                            <div className="bg-gray-900 aspect-video w-56 flex items-center justify-center">
                              <div className="text-center text-white">
                                <VideoCamera
                                  size={48}
                                  className="mx-auto mb-2"
                                />
                                {hasFile && (
                                  <p className="text-xs px-2">
                                    {msg.file.name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                              <div className="w-12 h-12 bg-white bg-opacity-80 rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-gray-800 border-b-[8px] border-b-transparent ml-1"></div>
                              </div>
                            </div>
                          </div>
                        ) : msg.type === 'audio' ? (
                          <div className="px-3 py-2 flex items-center gap-3 min-w-[200px]">
                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Microphone
                                size={20}
                                className="text-white"
                                weight="fill"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="h-6 bg-gray-200 rounded-full flex items-center px-2">
                                <div className="flex-1 h-1 bg-green-600 rounded"></div>
                              </div>
                              {hasFile && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {msg.file.name}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">0:15</span>
                          </div>
                        ) : msg.type === 'pdf' ? (
                          <div className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FilePdf
                                  size={24}
                                  className="text-red-600"
                                  weight="fill"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                  {hasFile ? msg.file.name : 'Documento.pdf'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  PDF • 1 página
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Timestamp e check (canto inferior direito) */}
                        <div className="px-3 pb-1 flex items-center justify-end gap-1">
                          <span className="text-[10px] text-gray-500">
                            {new Date().toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <Checks
                            size={14}
                            className="text-blue-500"
                            weight="fill"
                          />
                        </div>
                      </div>

                      {/* Indicador de sequência */}
                      {index < messages.length - 1 && (
                        <div className="w-0.5 h-2 bg-gray-300 rounded-full"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer com botões de ação */}
              <div className="p-4 bg-gray-100 border-t border-gray-200 rounded-b-2xl">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold text-sm transition-colors"
                  >
                    Continuar Editando
                  </button>
                  <button
                    onClick={handleSendMessages}
                    disabled={isUploading}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                      isUploading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white`}
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        {uploadProgress}
                      </>
                    ) : (
                      <>
                        <PaperPlaneTilt size={18} weight="fill" />
                        Enviar Fluxo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Todos os Contatos */}
        {showContatosModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
              {/* Header do Modal */}
              <div className="bg-indigo-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users size={24} weight="fill" />
                  <div>
                    <h3 className="font-bold text-sm">Lista de Contatos</h3>
                    <p className="text-xs opacity-90">
                      {contatos.length} contatos importados
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowContatosModal(false)}
                  className="p-2 hover:bg-indigo-700 rounded-full transition-colors"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              {/* Lista de Contatos */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {contatos.map((contato, index) => (
                    <div
                      key={contato.id}
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-8 text-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">
                            {contato.nome}
                          </p>
                          <p className="text-gray-500 text-xs truncate">
                            {contato.telefone}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          removerContato(contato.id);
                          if (contatos.length <= 1) {
                            setShowContatosModal(false);
                          }
                        }}
                        className="ml-2 p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-100 border-t border-gray-200 rounded-b-2xl">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowContatosModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold text-sm transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => {
                      limparContatos();
                      setShowContatosModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash size={18} weight="fill" />
                    Limpar Todos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrosbyBot;
