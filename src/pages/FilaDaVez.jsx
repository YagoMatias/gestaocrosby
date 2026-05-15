// Página PÚBLICA — Fila da Vez (acesso da vendedora no chão de loja)
// Acessada via URL /fila — login por PIN da loja
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Storefront,
  Lock,
  SignOut,
  Play,
  Pause,
  Stop,
  Sun,
  FirstAid,
  CheckCircle,
  XCircle,
  User,
  Crown,
  Trophy,
  Hourglass,
  Spinner,
  ArrowClockwise,
  TrendUp,
} from 'phosphor-react';
import { API_BASE_URL } from '../config/constants';

const STORAGE_KEY = 'fila_da_vez_session_v1';

// Helpers
const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
const fmtDuracao = (segs) => {
  const s = Math.max(0, Math.floor(Number(segs || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const STATUS_INFO = {
  disponivel: { label: 'Na fila', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  em_atendimento: { label: 'Em atendimento', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Play },
  pausa: { label: 'Em pausa', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Pause },
  folga: { label: 'Folga', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Sun },
  atestado: { label: 'Atestado', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: FirstAid },
  fora: { label: 'Fora da fila', color: 'bg-gray-100 text-gray-600 border-gray-300', icon: Stop },
};

// =============================================================
// Tela de Login PIN
// =============================================================
function LoginScreen({ onLogin }) {
  const [lojas, setLojas] = useState([]);
  const [branchCode, setBranchCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    // Carrega lojas configuradas (qualquer um pode ver lista, não retorna PIN)
    fetch(`${API_BASE_URL}/api/fila/lojas`)
      .then((r) => r.json())
      .then((j) => {
        const ativas = (j?.data?.lojas || []).filter((l) => l.configurada && l.ativo);
        setLojas(ativas);
      })
      .catch(() => setLojas([]));
  }, []);

  const submeter = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!branchCode || !pin) {
      setErro('Selecione a loja e digite o PIN');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/fila/public/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_code: Number(branchCode), pin }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        setErro(j?.message || 'Erro no login');
        return;
      }
      const session = {
        branchCode: Number(branchCode),
        pin,
        loja: j.data.loja,
        vendedoras: j.data.vendedoras,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      onLogin(session);
    } catch (e) {
      setErro('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000638] via-[#0a1450] to-[#000638] flex items-center justify-center p-4 font-barlow">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#000638] rounded-full mb-4">
            <Storefront size={32} weight="bold" className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#000638]">Fila da Vez</h1>
          <p className="text-sm text-gray-600 mt-1">Acesse com o PIN da sua loja</p>
        </div>

        <form onSubmit={submeter} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loja</label>
            <select
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#000638] focus:border-transparent outline-none"
              required
            >
              <option value="">Selecione a loja</option>
              {lojas.map((l) => (
                <option key={l.branch_code} value={l.branch_code}>
                  {l.name} ({l.uf})
                </option>
              ))}
            </select>
            {!lojas.length && (
              <p className="text-xs text-amber-600 mt-1">Nenhuma loja ativa — peça ao admin para configurar.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                inputMode="numeric"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#000638] focus:border-transparent outline-none text-lg tracking-widest"
                placeholder="••••"
                required
              />
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{erro}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#000638] hover:bg-[#0a1450] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================
// Tela "Quem é você?" — escolher vendedora
// =============================================================
function SelectVendedora({ session, onSelect, onLogout }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000638] via-[#0a1450] to-[#000638] p-4 font-barlow">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500">{session.loja?.uf}</p>
              <h1 className="text-xl font-bold text-[#000638]">{session.loja?.nome}</h1>
            </div>
            <button onClick={onLogout} className="text-gray-500 hover:text-red-600 inline-flex items-center gap-1 text-sm">
              <SignOut size={16} /> Sair
            </button>
          </div>

          <h2 className="text-lg font-semibold text-gray-800 mb-3">Quem é você?</h2>

          {(!session.vendedoras || !session.vendedoras.length) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
              Nenhuma vendedora cadastrada nesta loja. Peça ao gerente para cadastrar no painel admin.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {session.vendedoras?.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className="bg-gray-50 hover:bg-[#000638] hover:text-white border border-gray-200 hover:border-[#000638] rounded-xl p-4 transition group"
              >
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[#000638] group-hover:bg-white text-white group-hover:text-[#000638] flex items-center justify-center font-bold text-lg">
                  {(v.nome || '?').charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-medium leading-tight">{v.apelido || v.nome}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Modal: Finalizar Atendimento
// =============================================================
function FinalizarModal({ vendedora, session, onClose, onConfirm }) {
  const [step, setStep] = useState('escolha'); // escolha | venda | naovenda
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [valorVenda, setValorVenda] = useState('');
  const [observacao, setObservacao] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [motivos, setMotivos] = useState([]);
  const [motivoId, setMotivoId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/fila/public/motivos`, {
      headers: {
        'x-fila-branch': session.branchCode,
        'x-fila-pin': session.pin,
      },
    })
      .then((r) => r.json())
      .then((j) => setMotivos(j?.data?.motivos || []))
      .catch(() => setMotivos([]));
  }, [session]);

  const validarCpf = async () => {
    const clean = cpfCnpj.replace(/\D/g, '');
    if (clean.length !== 11 && clean.length !== 14) {
      setErro('CPF/CNPJ deve ter 11 ou 14 dígitos');
      return;
    }
    setLookingUp(true);
    setErro('');
    setLookupResult(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/fila/public/lookup-cliente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fila-branch': session.branchCode,
          'x-fila-pin': session.pin,
        },
        body: JSON.stringify({ cpf_cnpj: clean }),
      });
      const j = await r.json();
      if (j?.data?.encontrado) {
        setLookupResult(j.data.cliente);
      } else {
        setLookupResult({ encontrado: false });
      }
    } catch (e) {
      setErro('Erro consultando TOTVS');
    } finally {
      setLookingUp(false);
    }
  };

  const confirmar = async (houveVenda) => {
    setSubmitting(true);
    setErro('');
    try {
      const body = {
        vendedora_id: vendedora.id,
        houve_venda: houveVenda,
        cpf_cnpj: houveVenda ? cpfCnpj.replace(/\D/g, '') : null,
        motivo_id: !houveVenda ? Number(motivoId) || null : null,
        valor_venda: houveVenda && valorVenda ? Number(valorVenda.replace(',', '.')) : null,
        observacao: observacao || null,
      };
      const r = await fetch(`${API_BASE_URL}/api/fila/public/finalizar-atendimento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fila-branch': session.branchCode,
          'x-fila-pin': session.pin,
        },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        setErro(j?.message || 'Erro ao finalizar');
        return;
      }
      onConfirm();
    } catch (e) {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto font-barlow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#000638]">Finalizar atendimento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {step === 'escolha' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Houve venda?</p>
            <button
              onClick={() => setStep('venda')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <CheckCircle size={22} weight="bold" /> SIM, teve venda
            </button>
            <button
              onClick={() => setStep('naovenda')}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <XCircle size={22} weight="bold" /> Não, sem venda
            </button>
          </div>
        )}

        {step === 'venda' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ do cliente *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  inputMode="numeric"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#000638] outline-none"
                  placeholder="000.000.000-00"
                />
                <button
                  onClick={validarCpf}
                  disabled={lookingUp}
                  className="px-4 py-2 bg-[#000638] text-white rounded-lg hover:bg-[#0a1450] disabled:opacity-50 text-sm"
                >
                  {lookingUp ? '...' : 'Buscar'}
                </button>
              </div>
              {lookupResult && lookupResult.name && (
                <div className="mt-2 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded">
                  ✓ {lookupResult.name}
                </div>
              )}
              {lookupResult && lookupResult.encontrado === false && (
                <div className="mt-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded">
                  Cliente não encontrado no TOTVS — pode salvar mesmo assim
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor da venda (opcional)</label>
              <input
                type="text"
                value={valorVenda}
                onChange={(e) => setValorVenda(e.target.value)}
                inputMode="decimal"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#000638] outline-none"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#000638] outline-none"
              />
            </div>

            {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep('escolha')} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Voltar
              </button>
              <button
                onClick={() => confirmar(true)}
                disabled={submitting || !cpfCnpj.replace(/\D/g, '').length}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Confirmar venda'}
              </button>
            </div>
          </div>
        )}

        {step === 'naovenda' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {motivos.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${
                      String(motivoId) === String(m.id)
                        ? 'border-[#000638] bg-[#000638]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={m.id}
                      checked={String(motivoId) === String(m.id)}
                      onChange={(e) => setMotivoId(e.target.value)}
                      className="accent-[#000638]"
                    />
                    <span className="text-sm">{m.motivo}</span>
                  </label>
                ))}
                {!motivos.length && <p className="text-xs text-gray-500">Nenhum motivo cadastrado</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#000638] outline-none"
              />
            </div>

            {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep('escolha')} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Voltar
              </button>
              <button
                onClick={() => confirmar(false)}
                disabled={submitting || !motivoId}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// Painel da Vendedora (tela principal de operação)
// =============================================================
function PainelVendedora({ session, vendedora, onTrocarVendedora, onLogout }) {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acaoLoading, setAcaoLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const carregarEstado = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/fila/public/estado`, {
        headers: {
          'x-fila-branch': session.branchCode,
          'x-fila-pin': session.pin,
        },
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        setEstado(j.data);
        setErro('');
      } else {
        setErro(j?.message || 'Erro ao carregar estado');
      }
    } catch (e) {
      setErro('Sem conexão');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    carregarEstado();
  }, [carregarEstado]);

  // Auto-refresh a cada 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(carregarEstado, 10000);
    return () => clearInterval(t);
  }, [autoRefresh, carregarEstado]);

  const eu = useMemo(
    () => estado?.vendedoras?.find((v) => v.id === vendedora.id),
    [estado, vendedora],
  );

  const fila = useMemo(
    () => (estado?.vendedoras || []).filter((v) => v.status === 'disponivel' && v.posicao_fila != null)
      .sort((a, b) => a.posicao_fila - b.posicao_fila),
    [estado],
  );
  const minhaPosicao = eu?.posicao_fila ?? null;
  const souProxima = fila[0]?.id === vendedora.id;

  const acao = async (path, body = {}) => {
    setAcaoLoading(true);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/fila/public/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fila-branch': session.branchCode,
          'x-fila-pin': session.pin,
        },
        body: JSON.stringify({ vendedora_id: vendedora.id, ...body }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        setErro(j?.message || 'Erro na ação');
      } else {
        await carregarEstado();
      }
    } catch (e) {
      setErro('Erro de conexão');
    } finally {
      setAcaoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000638] to-[#0a1450] flex items-center justify-center font-barlow">
        <div className="text-white flex items-center gap-2">
          <Spinner size={24} className="animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[eu?.status || 'fora'];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000638] via-[#0a1450] to-[#000638] p-3 sm:p-6 font-barlow">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#000638] text-white flex items-center justify-center font-bold text-lg">
              {(vendedora.nome || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-gray-500">{session.loja?.nome}</p>
              <h1 className="text-base font-bold text-[#000638] leading-tight">{vendedora.apelido || vendedora.nome}</h1>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={carregarEstado} className="p-2 text-gray-500 hover:text-[#000638]" title="Atualizar">
              <ArrowClockwise size={18} className={acaoLoading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onTrocarVendedora} className="p-2 text-gray-500 hover:text-[#000638]" title="Trocar vendedora">
              <User size={18} />
            </button>
            <button onClick={onLogout} className="p-2 text-gray-500 hover:text-red-600" title="Sair">
              <SignOut size={18} />
            </button>
          </div>
        </div>

        {/* Card status atual */}
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border ${statusInfo.color}`}>
              <StatusIcon size={16} weight="bold" />
              {statusInfo.label}
            </span>
            {minhaPosicao != null && eu?.status === 'disponivel' && (
              <span className="text-2xl font-bold text-[#000638]">
                {souProxima ? <Crown size={28} weight="fill" className="inline text-yellow-500" /> : `#${minhaPosicao}`}
              </span>
            )}
          </div>

          {/* Botões principais (mudam conforme status) */}
          <div className="space-y-2">
            {eu?.status === 'em_atendimento' && (
              <button
                onClick={() => setShowFinalizar(true)}
                disabled={acaoLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Stop size={22} weight="bold" /> Finalizar atendimento
              </button>
            )}

            {eu?.status === 'disponivel' && souProxima && (
              <button
                onClick={() => acao('iniciar-atendimento')}
                disabled={acaoLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 animate-pulse"
              >
                <Play size={22} weight="bold" /> Iniciar atendimento
              </button>
            )}

            {eu?.status === 'disponivel' && !souProxima && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                <Hourglass size={18} weight="bold" />
                Aguarde sua vez. Próxima: <strong>{fila[0]?.apelido || fila[0]?.nome}</strong>
              </div>
            )}

            {(!eu || eu.status === 'fora') && (
              <button
                onClick={() => acao('entrar-fila')}
                disabled={acaoLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Play size={22} weight="bold" /> Entrar na fila
              </button>
            )}

            {['pausa', 'folga', 'atestado'].includes(eu?.status) && (
              <button
                onClick={() => acao('entrar-fila')}
                disabled={acaoLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Play size={22} weight="bold" /> Voltar à fila
              </button>
            )}

            {/* Ações secundárias - pausa/folga/atestado */}
            {eu?.status !== 'em_atendimento' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => acao('pausa', { tipo: 'pausa' })}
                  disabled={acaoLoading || eu?.status === 'pausa'}
                  className="bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-800 font-medium py-3 rounded-lg flex flex-col items-center gap-1 text-xs"
                >
                  <Pause size={18} weight="bold" /> Pausa
                </button>
                <button
                  onClick={() => acao('pausa', { tipo: 'folga' })}
                  disabled={acaoLoading || eu?.status === 'folga'}
                  className="bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-800 font-medium py-3 rounded-lg flex flex-col items-center gap-1 text-xs"
                >
                  <Sun size={18} weight="bold" /> Folga
                </button>
                <button
                  onClick={() => acao('pausa', { tipo: 'atestado' })}
                  disabled={acaoLoading || eu?.status === 'atestado'}
                  className="bg-rose-100 hover:bg-rose-200 disabled:opacity-50 text-rose-800 font-medium py-3 rounded-lg flex flex-col items-center gap-1 text-xs"
                >
                  <FirstAid size={18} weight="bold" /> Atestado
                </button>
              </div>
            )}
          </div>

          {erro && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>
          )}

          {/* Minhas métricas do dia */}
          {eu && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Atendimentos</p>
                <p className="text-xl font-bold text-[#000638]">{eu.atendimentos_hoje || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Vendas</p>
                <p className="text-xl font-bold text-emerald-600">{eu.vendas_hoje || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Conversão</p>
                <p className="text-xl font-bold text-[#000638]">{eu.conversao_hoje || 0}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Fila atual */}
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <h3 className="font-bold text-[#000638] mb-3 flex items-center gap-2">
            <TrendUp size={18} weight="bold" /> Fila da loja
          </h3>
          {!fila.length && <p className="text-sm text-gray-500">Ninguém na fila</p>}
          <div className="space-y-1">
            {fila.map((v, idx) => (
              <div
                key={v.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  v.id === vendedora.id ? 'bg-[#000638]/10 border border-[#000638]/30' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-[#000638] w-6">
                    {idx === 0 ? <Crown size={20} weight="fill" className="text-yellow-500" /> : `#${idx + 1}`}
                  </span>
                  <span className="text-sm font-medium">{v.apelido || v.nome}</span>
                  {v.id === vendedora.id && <span className="text-xs text-[#000638]">(você)</span>}
                </div>
                <span className="text-xs text-gray-500">{v.atendimentos_hoje || 0} atend. hoje</span>
              </div>
            ))}
          </div>

          {/* Outras vendedoras (não disponíveis) */}
          {estado?.vendedoras && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase mb-2">Outras</p>
              <div className="space-y-1">
                {estado.vendedoras
                  .filter((v) => v.status !== 'disponivel')
                  .map((v) => {
                    const si = STATUS_INFO[v.status || 'fora'];
                    return (
                      <div key={v.id} className="flex items-center justify-between px-3 py-1 text-sm">
                        <span className={v.id === vendedora.id ? 'font-bold' : ''}>
                          {v.apelido || v.nome} {v.id === vendedora.id && <span className="text-xs text-[#000638]">(você)</span>}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${si.color}`}>{si.label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showFinalizar && (
        <FinalizarModal
          vendedora={vendedora}
          session={session}
          onClose={() => setShowFinalizar(false)}
          onConfirm={async () => {
            setShowFinalizar(false);
            await carregarEstado();
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// Componente raiz
//
// Modo público (default): mostra LoginScreen → SelectVendedora → PainelVendedora
// Modo embedded: recebe `embeddedSession` (e opcional `onClose`) — pula login,
//                usa a sessão fornecida pelo container externo (ex: admin
//                operando a fila a partir do menu Varejo).
// =============================================================
export { LoginScreen, SelectVendedora, PainelVendedora };

export default function FilaDaVez({ embeddedSession = null, onClose = null } = {}) {
  const [session, setSession] = useState(embeddedSession);
  const [vendedoraSelecionada, setVendedoraSelecionada] = useState(null);

  useEffect(() => {
    if (embeddedSession) {
      setSession(embeddedSession);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.branchCode && parsed?.pin) {
          setSession(parsed);
        }
      }
    } catch {}
  }, [embeddedSession]);

  const logout = () => {
    if (embeddedSession) {
      // Modo embedded: fechar o container externo em vez de limpar localStorage
      if (onClose) onClose();
      setVendedoraSelecionada(null);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setVendedoraSelecionada(null);
  };

  if (!session) return <LoginScreen onLogin={setSession} />;
  if (!vendedoraSelecionada) {
    return (
      <SelectVendedora
        session={session}
        onSelect={setVendedoraSelecionada}
        onLogout={logout}
      />
    );
  }
  return (
    <PainelVendedora
      session={session}
      vendedora={vendedoraSelecionada}
      onTrocarVendedora={() => setVendedoraSelecionada(null)}
      onLogout={logout}
    />
  );
}
