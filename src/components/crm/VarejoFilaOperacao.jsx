// Sub-aba "Operação" — admin pode operar a fila de qualquer loja
// configurada, sem precisar digitar PIN (pega do banco automaticamente).
// Reaproveita o painel da vendedora (FilaDaVez em modo embedded).
import React, { useState, useEffect } from 'react';
import { Storefront, ArrowLeft, Info } from 'phosphor-react';
import { API_BASE_URL } from '../../config/constants';
import FilaDaVez from '../../pages/FilaDaVez';

export default function VarejoFilaOperacao() {
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [session, setSession] = useState(null);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Carrega lojas configuradas ativas
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/fila/lojas`)
      .then((r) => r.json())
      .then((j) => {
        const ativas = (j?.data?.lojas || []).filter((l) => l.configurada && l.ativo);
        setLojas(ativas);
      })
      .catch(() => setErro('Falha ao carregar lojas'))
      .finally(() => setLoading(false));
  }, []);

  // Quando admin escolhe uma loja, faz login automático (pega PIN do banco)
  const escolherLoja = async (loja) => {
    setLoadingLogin(true);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/fila/public/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_code: loja.branch_code, pin: loja.pin }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Falha no login');
      setSession({
        branchCode: loja.branch_code,
        pin: loja.pin,
        loja: j.data.loja,
        vendedoras: j.data.vendedoras,
      });
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoadingLogin(false);
    }
  };

  const voltarParaLojas = () => setSession(null);

  // Já está dentro de uma loja — renderiza o painel da vendedora embedded
  if (session) {
    return (
      <div className="space-y-2 font-barlow">
        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-[#000638]/10">
          <button
            onClick={voltarParaLojas}
            className="text-xs text-[#000638] hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Trocar de loja
          </button>
          <span className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Info size={12} /> Operando: <strong>{session.loja?.nome}</strong>
          </span>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <FilaDaVez embeddedSession={session} onClose={voltarParaLojas} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-barlow">
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-md border border-[#000638]/10">
        <h3 className="text-base font-bold text-[#000638] flex items-center gap-2">
          <Storefront size={18} weight="bold" /> Operação da Fila
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Escolha uma loja pra operar a fila como se fosse uma vendedora (admin
          não precisa digitar PIN — o sistema usa o configurado).
        </p>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Carregando lojas...</p>
      ) : lojas.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded text-sm">
          Nenhuma loja com Fila configurada e ativa. Vá em <strong>Configuração</strong> pra ativar.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lojas.map((l) => (
            <button
              key={l.branch_code}
              onClick={() => escolherLoja(l)}
              disabled={loadingLogin}
              className="bg-white hover:bg-[#000638] hover:text-white border border-gray-200 hover:border-[#000638] rounded-xl p-4 transition group disabled:opacity-50 text-left"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-[#000638] group-hover:text-white">{l.name}</h4>
                  <p className="text-xs text-gray-500 group-hover:text-gray-300">#{l.branch_code} • {l.uf}</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ativa</span>
              </div>
              <p className="text-xs text-gray-500 group-hover:text-gray-300 mt-2">Clique para operar →</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
