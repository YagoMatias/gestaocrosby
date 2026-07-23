// RH / Banco de Talentos → Inscrições de uma vaga
// Lista os candidatos, permite baixar o currículo (signed URL) e mudar o status.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  DownloadSimple,
  Spinner,
  Users,
  EnvelopeSimple,
  Phone,
  MapPin,
  FileText,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import PageTitle from '../../components/ui/PageTitle';
import { API_BASE_URL } from '../../config/constants';

// Status do funil de recrutamento
const STATUS = [
  { value: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700 ring-blue-200' },
  { value: 'triagem', label: 'Triagem', color: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { value: 'entrevista', label: 'Entrevista', color: 'bg-purple-100 text-purple-700 ring-purple-200' },
  { value: 'aprovado', label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { value: 'reprovado', label: 'Reprovado', color: 'bg-rose-100 text-rose-700 ring-rose-200' },
  { value: 'banco', label: 'Banco de talentos', color: 'bg-gray-100 text-gray-600 ring-gray-200' },
];
const statusInfo = (s) => STATUS.find((o) => o.value === s) || STATUS[0];

const fmtData = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export default function VagaInscricoes() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('vaga');
  const navigate = useNavigate();
  const [vaga, setVaga] = useState(null);
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [vagasRes, inscRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/vagas`).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/vagas/${id}/inscricoes`).then((r) => r.json()),
      ]);
      if (vagasRes?.success) {
        setVaga((vagasRes.data || []).find((v) => String(v.id) === String(id)) || null);
      }
      if (!inscRes?.success) throw new Error(inscRes?.message || 'Erro ao carregar inscrições');
      setInscricoes(inscRes.data || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mudarStatus = async (insc, status) => {
    // Otimista
    setInscricoes((list) => list.map((i) => (i.id === insc.id ? { ...i, status } : i)));
    try {
      const r = await fetch(`${API_BASE_URL}/api/vagas/inscricoes/${insc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
    } catch (e) {
      alert(e.message);
      carregar();
    }
  };

  // Contagem por status (para os chips de filtro)
  const contagem = useMemo(() => {
    const c = { todos: inscricoes.length };
    for (const i of inscricoes) {
      const s = i.status || 'novo';
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [inscricoes]);

  // Lista aplicando busca (nome/e-mail/telefone) + status
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigits = termo.replace(/\D/g, '');
    return inscricoes.filter((i) => {
      if (filtroStatus !== 'todos' && (i.status || 'novo') !== filtroStatus) return false;
      if (!termo) return true;
      const nomeMatch = (i.nome || '').toLowerCase().includes(termo);
      const emailMatch = (i.email || '').toLowerCase().includes(termo);
      const telMatch =
        termoDigits !== '' &&
        String(i.telefone || '').replace(/\D/g, '').includes(termoDigits);
      return nomeMatch || emailMatch || telMatch;
    });
  }, [inscricoes, busca, filtroStatus]);

  const baixarCurriculo = async (insc) => {
    setBaixando(insc.id);
    try {
      const r = await fetch(`${API_BASE_URL}/api/vagas/inscricoes/${insc.id}/curriculo`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Sem currículo');
      window.open(j.data.url, '_blank', 'noopener');
    } catch (e) {
      alert(e.message);
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <button
        onClick={() => navigate('/rh/vagas')}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#000638] mb-3 transition"
      >
        <ArrowLeft size={16} weight="bold" />
        Voltar para vagas
      </button>

      <PageTitle
        title={vaga ? vaga.titulo : 'Inscrições'}
        subtitle={
          vaga
            ? [vaga.cargo, [vaga.cidade, vaga.estado].filter(Boolean).join(' / ')]
                .filter(Boolean)
                .join(' · ')
            : 'Candidatos inscritos nesta vaga'
        }
        icon={Briefcase}
      />

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {erro}
        </div>
      )}

      {/* Barra de filtros */}
      {!loading && inscricoes.length > 0 && (
        <div className="mb-4 font-barlow space-y-3">
          <div className="relative max-w-sm">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone…"
              className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 outline-none transition"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition ${
                filtroStatus === 'todos'
                  ? 'bg-[#000638] text-white ring-[#000638]'
                  : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300'
              }`}
            >
              Todos <span className="opacity-70">({contagem.todos || 0})</span>
            </button>
            {STATUS.map((o) => (
              <button
                key={o.value}
                onClick={() => setFiltroStatus(o.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition ${
                  filtroStatus === o.value
                    ? `${o.color} ring-transparent`
                    : 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-300'
                }`}
              >
                {o.label} <span className="opacity-70">({contagem[o.value] || 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Spinner size={28} className="animate-spin" />
        </div>
      ) : inscricoes.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-barlow">
          <Users size={44} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nenhuma inscrição ainda.</p>
          <p className="text-sm">Compartilhe o link da vaga para começar a receber candidatos.</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-barlow">
          <MagnifyingGlass size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nenhum candidato encontrado.</p>
          <p className="text-sm">Ajuste a busca ou o filtro de status.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden font-barlow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 font-bold">Candidato</th>
                  <th className="px-4 py-3 font-bold">Contato</th>
                  <th className="px-4 py-3 font-bold">Local</th>
                  <th className="px-4 py-3 font-bold">Indicação</th>
                  <th className="px-4 py-3 font-bold">Data</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-center">Currículo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtradas.map((i) => {
                  const si = statusInfo(i.status);
                  return (
                    <tr key={i.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#000638]">{i.nome}</div>
                        {i.cargo && <div className="text-xs text-gray-400">{i.cargo}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {i.email && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <EnvelopeSimple size={13} className="text-gray-400" />
                            <a href={`mailto:${i.email}`} className="hover:text-[#000638]">{i.email}</a>
                          </div>
                        )}
                        {i.telefone && (
                          <div className="flex items-center gap-1.5 text-xs mt-0.5">
                            <Phone size={13} className="text-gray-400" />
                            <a
                              href={`https://wa.me/55${String(i.telefone).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-emerald-600"
                            >
                              {i.telefone}
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {(i.cidade || i.estado) ? (
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin size={13} className="text-gray-400" />
                            {[i.cidade, i.estado].filter(Boolean).join(' / ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {i.indicacao === 'Sim' ? (
                          <span title={i.indicado_por || ''}>
                            Sim{i.indicado_por ? ` · ${i.indicado_por}` : ''}
                          </span>
                        ) : (
                          'Não'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtData(i.criado_em)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={i.status || 'novo'}
                          onChange={(e) => mudarStatus(i, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 ring-1 outline-none cursor-pointer ${si.color}`}
                        >
                          {STATUS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {i.curriculo_path ? (
                          <button
                            onClick={() => baixarCurriculo(i)}
                            disabled={baixando === i.id}
                            title="Baixar currículo"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#000638] hover:text-[#0a1450] disabled:opacity-50"
                          >
                            {baixando === i.id ? (
                              <Spinner size={15} className="animate-spin" />
                            ) : (
                              <DownloadSimple size={15} weight="bold" />
                            )}
                            Baixar
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 flex items-center gap-1 justify-center">
                            <FileText size={14} /> —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
