import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  Spinner,
  CheckCircle,
  ShoppingCart,
  CurrencyDollar,
  CalendarBlank,
  Clock,
  Warning,
  ChartLineUp,
  Camera,
  InstagramLogo,
  PencilSimple,
  FileArrowUp,
  FileText,
  Trash,
  DownloadSimple,
  X,
  Storefront,
  Star,
  Phone,
  Envelope,
  MapPin,
  IdentificationCard,
  FolderOpen,
} from '@phosphor-icons/react';

const BUCKET_NAME = 'clientes-confianca';
const SUPABASE_URL = 'https://dorztqiunewggydvkjnf.supabase.co';
const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

const CATEGORIAS_DOCUMENTOS = [
  { key: 'cartao_cnpj', label: 'Cartão CNPJ' },
  { key: 'google_maps', label: 'Google Maps da Loja' },
  { key: 'comprovante_qsa', label: 'Comprovante QSA' },
  { key: 'rg_cpf_socios', label: 'RG e CPF dos Sócios' },
  { key: 'comprovante_endereco', label: 'Comprov. Endereço Empresa' },
  { key: 'score_cnpj', label: 'Score SPC/Serasa CNPJ' },
  { key: 'score_socios', label: 'Score SPC/Serasa Sócios' },
  { key: 'doc_retirada_rastreio', label: 'Doc. Retirada / Rastreio / Taxista' },
  { key: 'declaracao_fiador', label: 'Declaração Resp. e Fiador' },
];

const ClientePerfilModal = ({
  isOpen,
  onClose,
  clienteCode,
  clienteNome,
  clienteCnpj,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [perfil, setPerfil] = useState(null);
  const [instagram, setInstagram] = useState('');
  const [editandoInstagram, setEditandoInstagram] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const fotoInputRef = useRef(null);
  const [dadosPessoa, setDadosPessoa] = useState(null);
  const [modalFotoAberta, setModalFotoAberta] = useState(false);
  const [documentos, setDocumentos] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef(null);
  const [abaDocAtiva, setAbaDocAtiva] = useState(CATEGORIAS_DOCUMENTOS[0].key);

  const isAdmin =
    user?.user_metadata?.role === 'owner' ||
    user?.user_metadata?.role === 'admin';

  const dentroDoPrazo = (createdAt) => {
    if (!createdAt) return false;
    const criacao = new Date(createdAt).getTime();
    const agora = Date.now();
    return agora - criacao < 5 * 60 * 1000;
  };

  const podeAlterarPerfil = () => {
    if (isAdmin) return true;
    return perfil?.updated_at ? dentroDoPrazo(perfil.updated_at) : true;
  };

  const podeRemoverDocumento = (doc) => {
    if (isAdmin) return true;
    return dentroDoPrazo(doc.created_at);
  };

  const formatCurrency = (value) =>
    (parseFloat(value) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const formatDateBR = (dateStr) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('pt-BR');
  };

  const carregarPerfil = async (personCode) => {
    try {
      const { data } = await supabase
        .from('clientes_confianca_perfil')
        .select('*')
        .eq('person_code', personCode)
        .maybeSingle();
      if (data) {
        setPerfil(data);
        setInstagram(data.instagram || '');
      } else {
        setPerfil(null);
        setInstagram('');
      }
    } catch {
      setPerfil(null);
      setInstagram('');
    }
  };

  const carregarDadosPessoa = async (personCode) => {
    try {
      const { data } = await supabase
        .from('pes_pessoa')
        .select(
          'code, nm_pessoa, fantasy_name, cpf, telefone, email, phones, emails, addresses, uf',
        )
        .eq('code', personCode)
        .maybeSingle();
      setDadosPessoa(data || null);
    } catch {
      setDadosPessoa(null);
    }
  };

  const carregarDocumentos = async (personCode) => {
    try {
      const { data } = await supabase
        .from('clientes_confianca_documentos')
        .select('*')
        .eq('person_code', personCode)
        .order('created_at', { ascending: false });
      setDocumentos(data || []);
    } catch {
      setDocumentos([]);
    }
  };

  // Buscar tudo ao abrir
  useEffect(() => {
    if (!isOpen || !clienteCode) return;
    setDados(null);
    setPerfil(null);
    setDadosPessoa(null);
    setDocumentos([]);
    setErro('');
    setEditandoInstagram(false);
    setModalFotoAberta(false);

    (async () => {
      setLoading(true);
      try {
        const personCode = parseInt(clienteCode);
        const resp = await fetch(`${TotvsURL}person-statistics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personCode }),
        });
        const json = await resp.json();
        if (json.success) {
          setDados(json.data);
          await carregarPerfil(personCode);
          await carregarDadosPessoa(personCode);
          await carregarDocumentos(personCode);
        } else {
          setErro(json.message || 'Erro ao buscar estatísticas');
        }
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        setErro('Erro ao conectar com o servidor');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, clienteCode]);

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !clienteCode) return;
    if (perfil?.foto_path && !podeAlterarPerfil()) {
      alert(
        'O prazo de 5 minutos para alterar a foto expirou. Somente um administrador pode alterá-la.',
      );
      if (fotoInputRef.current) fotoInputRef.current.value = '';
      return;
    }
    setFotoLoading(true);
    try {
      const personCode = parseInt(clienteCode);
      const ext = file.name.split('.').pop();
      const path = `fotos/${personCode}.${ext}`;
      if (perfil?.foto_path) {
        await supabase.storage.from(BUCKET_NAME).remove([perfil.foto_path]);
      }
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      await supabase.from('clientes_confianca_perfil').upsert(
        {
          person_code: personCode,
          foto_path: path,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'person_code' },
      );
      await carregarPerfil(personCode);
    } catch (err) {
      console.error('Erro ao fazer upload da foto:', err);
      alert('Erro ao enviar foto.');
    } finally {
      setFotoLoading(false);
    }
  };

  const salvarInstagram = async () => {
    if (!clienteCode) return;
    if (perfil?.instagram && !podeAlterarPerfil()) {
      alert(
        'O prazo de 5 minutos para alterar o Instagram expirou. Somente um administrador pode alterá-lo.',
      );
      setEditandoInstagram(false);
      setInstagram(perfil.instagram);
      return;
    }
    const personCode = parseInt(clienteCode);
    try {
      await supabase.from('clientes_confianca_perfil').upsert(
        {
          person_code: personCode,
          instagram: instagram.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'person_code' },
      );
      setEditandoInstagram(false);
      await carregarPerfil(personCode);
    } catch (err) {
      console.error('Erro ao salvar Instagram:', err);
    }
  };

  const handleUploadDocumento = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !clienteCode) return;
    setUploadingDoc(true);
    try {
      const personCode = parseInt(clienteCode);
      const uid = crypto.randomUUID?.() || String(Date.now());
      const ext = file.name.split('.').pop();
      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `documentos/${personCode}/${abaDocAtiva}/${uid}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      await supabase.from('clientes_confianca_documentos').insert({
        person_code: personCode,
        nome_arquivo: file.name,
        file_path: path,
        tipo: file.type,
        uploaded_by: user?.id || null,
        categoria: abaDocAtiva,
      });
      await carregarDocumentos(personCode);
    } catch (err) {
      console.error('Erro ao fazer upload do documento:', err);
      alert('Erro ao enviar documento.');
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const removerDocumento = async (doc) => {
    if (!podeRemoverDocumento(doc)) {
      alert(
        'O prazo de 5 minutos para remover este documento expirou. Somente um administrador pode removê-lo.',
      );
      return;
    }
    if (!confirm(`Remover "${doc.nome_arquivo}"?`)) return;
    try {
      await supabase.storage.from(BUCKET_NAME).remove([doc.file_path]);
      await supabase
        .from('clientes_confianca_documentos')
        .delete()
        .eq('id', doc.id);
      await carregarDocumentos(parseInt(clienteCode));
    } catch (err) {
      console.error('Erro ao remover documento:', err);
    }
  };

  const downloadDocumento = async (doc) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar documento:', err);
    }
  };

  const getFotoUrl = () => {
    if (!perfil?.foto_path) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${perfil.foto_path}`;
  };

  const getInstagramUrl = () => {
    if (!perfil?.instagram) return null;
    const handle = perfil.instagram.replace(/^@/, '').trim();
    return `https://instagram.com/${handle}`;
  };

  const getScoreColor = () => {
    if (!dados) return 'text-gray-400';
    const avg = dados.averageDelay ?? 0;
    if (avg <= 5) return 'text-green-500';
    if (avg <= 15) return 'text-yellow-500';
    if (avg <= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = () => {
    if (!dados) return '--';
    const avg = dados.averageDelay ?? 0;
    if (avg <= 5) return 'Excelente';
    if (avg <= 15) return 'Bom';
    if (avg <= 30) return 'Regular';
    return 'Crítico';
  };

  const MetricRow = ({ label, value, color }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${color || 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl my-8 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-700" weight="bold" />
        </button>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-xl p-16 flex flex-col items-center justify-center gap-3">
            <Spinner size={40} className="animate-spin text-[#000638]" />
            <p className="text-sm text-gray-500">
              Carregando perfil do cliente...
            </p>
          </div>
        )}

        {/* Erro */}
        {!loading && erro && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          </div>
        )}

        {/* Perfil Completo */}
        {!loading && dados && (
          <div className="space-y-6">
            {/* Modal Foto Ampliada */}
            {modalFotoAberta && getFotoUrl() && (
              <div
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
                onClick={() => setModalFotoAberta(false)}
              >
                <div
                  className="relative max-w-3xl max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setModalFotoAberta(false)}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
                  >
                    <X size={18} className="text-gray-700" weight="bold" />
                  </button>
                  <img
                    src={getFotoUrl()}
                    alt="Foto da loja ampliada"
                    className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
                  />
                </div>
              </div>
            )}

            {/* Header do Perfil */}
            <div className="bg-gradient-to-r from-[#000638] via-[#0a1654] to-[#1a2980] rounded-2xl shadow-lg overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-[#000638]/80 to-[#1a2980]/60" />
              <div className="relative px-6 pb-6">
                <div className="absolute -top-14 left-6">
                  <div className="relative group">
                    <div
                      className={`w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-200 flex items-center justify-center ${getFotoUrl() ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                      onClick={() => getFotoUrl() && setModalFotoAberta(true)}
                      title={getFotoUrl() ? 'Clique para ampliar' : ''}
                    >
                      {getFotoUrl() ? (
                        <img
                          src={getFotoUrl()}
                          alt="Foto da loja"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Storefront size={48} className="text-gray-400" />
                      )}
                    </div>
                    <button
                      onClick={() => fotoInputRef.current?.click()}
                      disabled={fotoLoading}
                      className="absolute bottom-1 right-1 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      {fotoLoading ? (
                        <Spinner
                          size={14}
                          className="animate-spin text-[#000638]"
                        />
                      ) : (
                        <Camera size={14} className="text-[#000638]" />
                      )}
                    </button>
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFoto}
                      className="hidden"
                    />
                  </div>
                </div>
                <div className="pt-16">
                  <h1 className="text-2xl font-bold text-white">
                    {dadosPessoa?.fantasy_name ||
                      clienteNome ||
                      `Cliente ${clienteCode}`}
                  </h1>
                  <p className="text-sm text-gray-300 mt-0.5">
                    {dadosPessoa?.nm_pessoa || clienteNome || ''}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
                      Cód: {clienteCode}
                    </span>
                    {clienteCnpj && (
                      <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
                        {clienteCnpj}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações de Contato */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-5 py-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-[#000638] flex items-center gap-2">
                  <IdentificationCard size={16} className="text-[#000638]" />{' '}
                  Informações de Contato
                </h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <IdentificationCard size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      CNPJ / CPF
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {dadosPessoa?.cpf || clienteCnpj || '--'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Phone size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Telefone
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {dadosPessoa?.telefone || '--'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Envelope size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      E-mail
                    </p>
                    <p className="text-sm font-medium text-gray-900 break-all">
                      {dadosPessoa?.email || '--'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Endereço
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        const addr = dadosPessoa?.addresses;
                        if (!addr) return dadosPessoa?.uf || '--';
                        const main = Array.isArray(addr)
                          ? addr.find((a) => a.isDefault) || addr[0]
                          : addr;
                        if (!main) return dadosPessoa?.uf || '--';
                        const parts = [
                          main.address || main.street,
                          main.number,
                          main.complement,
                          main.neighborhood || main.district,
                          main.city || main.cityDescription,
                          main.state || main.uf || dadosPessoa?.uf,
                          main.zipCode || main.cep,
                        ].filter(Boolean);
                        return parts.length > 0
                          ? parts.join(', ')
                          : dadosPessoa?.uf || '--';
                      })()}
                    </p>
                  </div>
                </div>
                {/* Instagram */}
                <div className="flex items-center gap-3 md:col-span-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center flex-shrink-0">
                    <InstagramLogo size={18} className="text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Instagram
                    </p>
                    {editandoInstagram ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1 max-w-xs">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                            @
                          </span>
                          <input
                            type="text"
                            value={instagram}
                            onChange={(e) => setInstagram(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') salvarInstagram();
                            }}
                            placeholder="usuario"
                            className="border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-gray-50"
                          />
                        </div>
                        <button
                          onClick={salvarInstagram}
                          className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <CheckCircle size={16} weight="bold" />
                        </button>
                        <button
                          onClick={() => {
                            setEditandoInstagram(false);
                            setInstagram(perfil?.instagram || '');
                          }}
                          className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <X size={16} weight="bold" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {perfil?.instagram ? (
                          <a
                            href={getInstagramUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-pink-600 hover:text-pink-700 hover:underline transition-colors"
                          >
                            @{perfil.instagram}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">
                            Não informado
                          </span>
                        )}
                        <button
                          onClick={() => setEditandoInstagram(true)}
                          className="p-1 text-gray-400 hover:text-[#000638] transition-colors"
                          title="Editar Instagram"
                        >
                          <PencilSimple size={14} weight="bold" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Score + Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col items-center justify-center">
                <Star size={28} className={getScoreColor()} weight="fill" />
                <p className={`text-lg font-bold mt-1 ${getScoreColor()}`}>
                  {getScoreLabel()}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                  Score
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-[#000638]">
                  {dados.purchaseQuantity ?? 0}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                  Compras
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(dados.totalPurchaseValue)}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                  Total Comprado
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {dados.quantityInstallmentsOpen ?? 0}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                  Parcelas Abertas
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {dados.averageDelay ?? 0}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}
                    dias
                  </span>
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                  Atraso Médio
                </p>
              </div>
            </div>

            {/* Grid de Seções */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Compras */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-[#000638] flex items-center gap-2">
                    <ShoppingCart size={16} className="text-blue-600" />{' '}
                    Histórico de Compras
                  </h3>
                </div>
                <div className="p-5">
                  <MetricRow
                    label="Quantidade de Compras"
                    value={dados.purchaseQuantity ?? '--'}
                  />
                  <MetricRow
                    label="Quantidade de Peças"
                    value={dados.purchasePiecesQuantity ?? '--'}
                  />
                  <MetricRow
                    label="Total de Compras"
                    value={formatCurrency(dados.totalPurchaseValue)}
                    color="text-green-600"
                  />
                  <MetricRow
                    label="Média por Compra"
                    value={formatCurrency(dados.averagePurchaseValue)}
                  />
                  <MetricRow
                    label="Maior Compra"
                    value={`${formatCurrency(dados.biggestPurchaseValue)} (${formatDateBR(dados.biggestPurchaseDate)})`}
                    color="text-purple-600"
                  />
                  <MetricRow
                    label="Primeira Compra"
                    value={`${formatCurrency(dados.firstPurchaseValue)} (${formatDateBR(dados.firstPurchaseDate)})`}
                  />
                  <MetricRow
                    label="Última Compra"
                    value={`${formatCurrency(dados.lastPurchaseValue)} (${formatDateBR(dados.lastPurchaseDate)})`}
                    color="text-teal-600"
                  />
                </div>
              </div>

              {/* Parcelas Pagas */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-green-800 flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />{' '}
                    Parcelas Pagas
                  </h3>
                </div>
                <div className="p-5">
                  <MetricRow
                    label="Total Pago"
                    value={formatCurrency(dados.totalInstallmentsPaid)}
                    color="text-green-600"
                  />
                  <MetricRow
                    label="Qtd. Parcelas Pagas"
                    value={dados.quantityInstallmentsPaid ?? '--'}
                  />
                  <MetricRow
                    label="Média por Parcela"
                    value={formatCurrency(dados.averageValueInstallmentsPaid)}
                  />
                  <MetricRow
                    label="Última Fatura Paga"
                    value={`${formatCurrency(dados.lastInvoicePaidValue)} (${formatDateBR(dados.lastInvoicePaidDate)})`}
                    color="text-green-600"
                  />
                </div>
              </div>

              {/* Parcelas em Atraso */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-rose-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
                    <Warning size={16} className="text-red-600" /> Parcelas em
                    Atraso
                  </h3>
                </div>
                <div className="p-5">
                  <MetricRow
                    label="Total em Atraso"
                    value={formatCurrency(dados.totalInstallmentsDelayed)}
                    color="text-red-600"
                  />
                  <MetricRow
                    label="Qtd. Parcelas Atrasadas"
                    value={dados.quantityInstallmentsDelayed ?? '--'}
                  />
                  <MetricRow
                    label="Média de Atraso"
                    value={dados.averageInstallmentDelay ?? '--'}
                  />
                  <MetricRow
                    label="Atraso Médio"
                    value={`${dados.averageDelay ?? 0} dias`}
                    color="text-orange-600"
                  />
                  <MetricRow
                    label="Atraso Máximo"
                    value={`${dados.maximumDelay ?? 0} dias`}
                    color="text-red-700"
                  />
                </div>
              </div>

              {/* Em Aberto & Débitos */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <Clock size={16} className="text-amber-600" /> Em Aberto &
                    Débitos
                  </h3>
                </div>
                <div className="p-5">
                  <MetricRow
                    label="Total em Aberto"
                    value={formatCurrency(dados.totalInstallmentsOpen)}
                    color="text-amber-600"
                  />
                  <MetricRow
                    label="Qtd. Parcelas Abertas"
                    value={dados.quantityInstallmentsOpen ?? '--'}
                  />
                  <MetricRow
                    label="Média em Aberto"
                    value={formatCurrency(dados.averageInstallmentsOpen)}
                  />
                  <MetricRow
                    label="Maior Débito"
                    value={`${formatCurrency(dados.highestDebt)} (${formatDateBR(dados.highestDebtDate)})`}
                    color="text-red-600"
                  />
                  <MetricRow
                    label="Limite Coligado"
                    value={formatCurrency(dados.affiliateLimitAmount)}
                    color="text-blue-600"
                  />
                  <MetricRow
                    label="Último Aviso Cobrança"
                    value={formatDateBR(dados.lastDebtNoticeDate)}
                  />
                </div>
              </div>
            </div>

            {/* Documentos por Categoria */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                  <FolderOpen size={16} className="text-purple-600" />{' '}
                  Documentos do Cliente
                </h3>
              </div>

              {/* Abas de categorias */}
              <div className="border-b border-gray-200 overflow-x-auto">
                <div className="flex min-w-max">
                  {CATEGORIAS_DOCUMENTOS.map((cat) => {
                    const docsCategoria = documentos.filter(
                      (d) => d.categoria === cat.key,
                    );
                    const temDocs = docsCategoria.length > 0;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setAbaDocAtiva(cat.key)}
                        className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                          abaDocAtiva === cat.key
                            ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {cat.label}
                        {temDocs && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-green-100 text-green-700">
                            {docsCategoria.length}
                          </span>
                        )}
                        {!temDocs && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-red-100 text-red-500">
                            0
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conteúdo da aba ativa */}
              <div className="p-4">
                {/* Header com nome da categoria e botão de upload */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500">
                    {
                      CATEGORIAS_DOCUMENTOS.find((c) => c.key === abaDocAtiva)
                        ?.label
                    }
                  </p>
                  <button
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {uploadingDoc ? (
                      <Spinner size={12} className="animate-spin" />
                    ) : (
                      <FileArrowUp size={14} weight="bold" />
                    )}
                    Anexar Arquivo
                  </button>
                  <input
                    ref={docInputRef}
                    type="file"
                    onChange={handleUploadDocumento}
                    className="hidden"
                  />
                </div>

                {/* Lista de documentos da categoria ativa */}
                {(() => {
                  const docsAtivos = documentos.filter(
                    (d) => d.categoria === abaDocAtiva,
                  );
                  if (docsAtivos.length === 0) {
                    return (
                      <div className="text-center py-6 text-gray-400">
                        <FileText
                          size={32}
                          className="mx-auto mb-2 opacity-30"
                        />
                        <p className="text-xs">
                          Nenhum arquivo anexado nesta categoria
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {docsAtivos.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText
                              size={20}
                              className="text-purple-500 flex-shrink-0"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {doc.nome_arquivo}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {formatDateBR(doc.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => downloadDocumento(doc)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download"
                            >
                              <DownloadSimple size={16} weight="bold" />
                            </button>
                            {podeRemoverDocumento(doc) && (
                              <button
                                onClick={() => removerDocumento(doc)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remover"
                              >
                                <Trash size={16} weight="bold" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Resumo geral de todas as categorias */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                    Resumo de documentos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIAS_DOCUMENTOS.map((cat) => {
                      const count = documentos.filter(
                        (d) => d.categoria === cat.key,
                      ).length;
                      return (
                        <span
                          key={cat.key}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium ${
                            count > 0
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-500 border border-red-200'
                          }`}
                        >
                          {count > 0 ? (
                            <CheckCircle size={10} weight="fill" />
                          ) : (
                            <X size={10} />
                          )}
                          {cat.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientePerfilModal;
