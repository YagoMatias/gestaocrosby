// Aba "Fila da Vez" — visão ADMIN (menu principal de Varejo)
// Gerencia: configuração de loja (PIN), vendedoras, motivos
// Os dados/dashboard ficam separados em VarejoFilaDashboard (dentro de Reunião)
import React, { useState, useEffect, useCallback } from 'react';
import {
  Storefront,
  Key,
  Users,
  ListChecks,
  Plus,
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  LinkSimple,
  Play,
} from 'phosphor-react';
import { API_BASE_URL } from '../../config/constants';
import VarejoFilaOperacao from './VarejoFilaOperacao';

const SUBABA = [
  { id: 'operacao', label: 'Operação (Vendedora)', icon: Play },
  { id: 'config', label: 'Configuração', icon: Key },
  { id: 'vendedoras', label: 'Vendedoras', icon: Users },
  { id: 'motivos', label: 'Motivos', icon: ListChecks },
];

// =======================
// API helper
// =======================
const api = {
  async req(path, opts = {}) {
    const r = await fetch(`${API_BASE_URL}/api/fila${path}`, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
    return j.data;
  },
};

// =======================
// SUB-ABA: Configuração (PIN/Loja)
// =======================
function AbaConfig() {
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // branch_code do que está sendo editado
  const [pin, setPin] = useState('');
  const [mostrarPin, setMostrarPin] = useState({});
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.req('/lojas');
      setLojas(d.lojas || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async (loja, novaConfig = {}) => {
    setSaving(true);
    setErro('');
    try {
      const payload = {
        branch_code: loja.branch_code,
        pin: novaConfig.pin ?? loja.pin ?? pin,
        ativo: novaConfig.ativo ?? loja.ativo,
      };
      if (!payload.pin) {
        setErro('PIN obrigatório');
        return;
      }
      await api.req('/lojas', { method: 'POST', body: JSON.stringify(payload) });
      setEditing(null);
      setPin('');
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#000638] flex items-center gap-2">
            <Storefront size={18} weight="bold" /> Configuração das lojas
          </h3>
          <p className="text-xs text-gray-500">Defina um PIN único por loja para a vendedora acessar a fila</p>
        </div>
        <a
          href="/fila"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#000638] hover:underline"
        >
          <LinkSimple size={14} /> Abrir tela da vendedora
        </a>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lojas.map((l) => (
            <div
              key={l.branch_code}
              className={`bg-white p-4 rounded-xl shadow-md border ${
                l.configurada && l.ativo ? 'border-emerald-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-[#000638]">{l.name}</h4>
                  <p className="text-xs text-gray-500">#{l.branch_code} • {l.uf}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    l.configurada && l.ativo
                      ? 'bg-emerald-100 text-emerald-700'
                      : l.configurada
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {l.configurada ? (l.ativo ? 'Ativa' : 'Inativa') : 'Sem PIN'}
                </span>
              </div>

              {editing === l.branch_code ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="PIN 4-8 dígitos"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#000638] outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => salvar(l, { pin })}
                      disabled={saving || !pin}
                      className="flex-1 bg-[#000638] hover:bg-[#0a1450] text-white text-sm py-2 rounded-lg disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => {
                        setEditing(null);
                        setPin('');
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {l.configurada && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">PIN:</span>
                      <span className="font-mono font-bold text-[#000638]">
                        {mostrarPin[l.branch_code] ? l.pin : '••••'}
                      </span>
                      <button
                        onClick={() =>
                          setMostrarPin((p) => ({ ...p, [l.branch_code]: !p[l.branch_code] }))
                        }
                        className="text-gray-400 hover:text-[#000638]"
                      >
                        {mostrarPin[l.branch_code] ? <EyeSlash size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditing(l.branch_code);
                        setPin(l.pin || '');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg"
                    >
                      <PencilSimple size={14} /> {l.configurada ? 'Editar' : 'Definir PIN'}
                    </button>
                    {l.configurada && (
                      <button
                        onClick={() => salvar(l, { ativo: !l.ativo })}
                        className={`px-3 py-2 rounded-lg text-sm ${
                          l.ativo
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                        }`}
                      >
                        {l.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =======================
// SUB-ABA: Vendedoras
// =======================
function AbaVendedoras() {
  const [lojas, setLojas] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [filtroLoja, setFiltroLoja] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ branch_code: '', nome: '', apelido: '', totvs_id: '' });
  const [editId, setEditId] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.req('/lojas').then((d) => setLojas(d.lojas || [])).catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filtroLoja ? `?branch=${filtroLoja}` : '';
      const d = await api.req(`/vendedoras${qs}`);
      setVendedoras(d.vendedoras || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroLoja]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const submit = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (editId) {
        await api.req(`/vendedoras/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ nome: form.nome, apelido: form.apelido || null, totvs_id: form.totvs_id || null }),
        });
      } else {
        if (!form.branch_code || !form.nome) {
          setErro('Loja e nome obrigatórios');
          return;
        }
        await api.req('/vendedoras', {
          method: 'POST',
          body: JSON.stringify({
            branch_code: Number(form.branch_code),
            nome: form.nome,
            apelido: form.apelido || null,
            totvs_id: form.totvs_id || null,
          }),
        });
      }
      setForm({ branch_code: filtroLoja, nome: '', apelido: '', totvs_id: '' });
      setEditId(null);
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const remover = async (v) => {
    if (!confirm(`Remover ${v.nome}?`)) return;
    try {
      await api.req(`/vendedoras/${v.id}`, { method: 'DELETE' });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const lojasConfiguradas = lojas.filter((l) => l.configurada);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-[#000638] flex items-center gap-2 mb-2">
          <Users size={18} weight="bold" /> Vendedoras
        </h3>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-sm text-gray-700">Filtrar por loja:</label>
          <select
            value={filtroLoja}
            onChange={(e) => setFiltroLoja(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Todas</option>
            {lojas.map((l) => (
              <option key={l.branch_code} value={l.branch_code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={submit} className="bg-gray-50 p-3 rounded-lg space-y-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={form.branch_code}
              onChange={(e) => setForm({ ...form, branch_code: e.target.value })}
              disabled={!!editId}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              <option value="">Loja *</option>
              {lojasConfiguradas.map((l) => (
                <option key={l.branch_code} value={l.branch_code}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo *"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
            <input
              type="text"
              value={form.apelido}
              onChange={(e) => setForm({ ...form, apelido: e.target.value })}
              placeholder="Apelido (opcional)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              value={form.totvs_id}
              onChange={(e) => setForm({ ...form, totvs_id: e.target.value })}
              placeholder="Cód TOTVS (opcional)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1 bg-[#000638] hover:bg-[#0a1450] text-white text-sm px-4 py-2 rounded-lg"
            >
              <Plus size={14} /> {editId ? 'Atualizar' : 'Adicionar'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm({ branch_code: filtroLoja, nome: '', apelido: '', totvs_id: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-2">{erro}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#000638] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Loja</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Apelido</th>
                  <th className="px-3 py-2 text-left">TOTVS</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendedoras.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                      Nenhuma vendedora cadastrada
                    </td>
                  </tr>
                )}
                {vendedoras.map((v) => {
                  const loja = lojas.find((l) => l.branch_code === v.branch_code);
                  return (
                    <tr key={v.id} className="border-b border-gray-100">
                      <td className="px-3 py-2">{loja?.name || `#${v.branch_code}`}</td>
                      <td className="px-3 py-2 font-medium">{v.nome}</td>
                      <td className="px-3 py-2 text-gray-600">{v.apelido || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{v.totvs_id || '—'}</td>
                      <td className="px-3 py-2">
                        {v.ativo ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ativa</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inativa</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => {
                              setEditId(v.id);
                              setForm({
                                branch_code: v.branch_code,
                                nome: v.nome,
                                apelido: v.apelido || '',
                                totvs_id: v.totvs_id || '',
                              });
                            }}
                            className="p-1.5 text-gray-500 hover:text-[#000638]"
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button onClick={() => remover(v)} className="p-1.5 text-gray-500 hover:text-red-600">
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =======================
// SUB-ABA: Motivos
// =======================
function AbaMotivos() {
  const [motivos, setMotivos] = useState([]);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const d = await api.req('/motivos');
      setMotivos(d.motivos || []);
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = async (e) => {
    e.preventDefault();
    if (!novo.trim()) return;
    setErro('');
    try {
      const max = motivos.reduce((a, m) => Math.max(a, m.ordem || 0), 0);
      await api.req('/motivos', {
        method: 'POST',
        body: JSON.stringify({ motivo: novo.trim(), ordem: max + 10 }),
      });
      setNovo('');
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const toggleAtivo = async (m) => {
    try {
      await api.req(`/motivos/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !m.ativo }),
      });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-[#000638] flex items-center gap-2 mb-2">
          <ListChecks size={18} weight="bold" /> Motivos de não-venda
        </h3>
        <p className="text-xs text-gray-500 mb-3">Vendedoras escolhem um desses ao finalizar atendimento sem venda</p>
      </div>

      <form onSubmit={adicionar} className="flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Novo motivo (ex: 'Sem tamanho')"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button className="inline-flex items-center gap-1 bg-[#000638] hover:bg-[#0a1450] text-white text-sm px-4 py-2 rounded-lg">
          <Plus size={14} /> Adicionar
        </button>
      </form>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}

      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {motivos.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Nenhum motivo cadastrado</p>}
        {motivos.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${m.ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{m.motivo}</span>
              {!m.ativo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inativo</span>}
            </div>
            <button
              onClick={() => toggleAtivo(m)}
              className={`text-xs px-2 py-1 rounded ${
                m.ativo ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
              {m.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =======================
// Container principal
// =======================
export default function VarejoFilaAdmin() {
  const [aba, setAba] = useState('operacao');

  return (
    <div className="space-y-3 font-barlow">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
        {SUBABA.map((s) => {
          const Icon = s.icon;
          const active = aba === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setAba(s.id)}
              className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium transition border-b-2 -mb-px ${
                active
                  ? 'text-[#000638] border-[#000638]'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={14} weight={active ? 'bold' : 'regular'} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div>
        {aba === 'operacao' && <VarejoFilaOperacao />}
        {aba === 'config' && <AbaConfig />}
        {aba === 'vendedoras' && <AbaVendedoras />}
        {aba === 'motivos' && <AbaMotivos />}
      </div>
    </div>
  );
}
