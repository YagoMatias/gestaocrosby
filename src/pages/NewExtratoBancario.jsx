// Página: Financeiro → New Extrato Bancário
// Reconstrução do Extrato Bancário do zero (pedido do Yago, 05/11/2026).
// Por enquanto: os MESMOS filtros e o MESMO visual da página atual
// (FluxoCaixaExt), mas a tabela fica vazia — nenhum dado é carregado ainda.
// Só as opções dos seletores (bancos/contas/CNPJs) vêm da API, para o filtro
// já funcionar igual.
import React, { useEffect, useMemo, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { Wallet, X, ArrowsClockwise, MagnifyingGlass, FunnelSimple, Export, UploadSimple, Info } from '@phosphor-icons/react';
import { MultiSelect, SeletorCnpj, BANCOS, bancoCfg, docDaConta, fmtDoc, Th, hoje, primeiroDiaMes } from './FluxoCaixaExt';

const API = `${API_BASE_URL}/api/fluxo-caixa-ext`;
const SUBTITULO = 'Nova versão do Extrato Bancário, montada do zero. Por enquanto só os filtros; a tabela ainda não traz dados.';

const NewExtratoBancario = () => {
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hoje());
  const [bancos, setBancos] = useState([]);
  const [contasSel, setContasSel] = useState([]);
  const [cnpjsSel, setCnpjsSel] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [formas, setFormas] = useState([]);
  const [contraparte, setContraparte] = useState('');
  const [busca, setBusca] = useState('');
  const [contasLista, setContasLista] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // só as contas cadastradas, para os seletores de Banco / CNPJ / Conta
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${API}/contas`);
        const j = await r.json();
        if (vivo && j?.success) setContasLista(j.data || []);
      } catch {
        /* sem opções por enquanto */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const bancosPresentes = useMemo(() => [...new Set(contasLista.map((c) => c.banco))], [contasLista]);
  const limparFiltros = () => {
    setBancos([]);
    setContasSel([]);
    setCnpjsSel([]);
    setTipos([]);
    setFormas([]);
    setContraparte('');
    setBusca('');
  };
  const filtrosAtivos = bancos.length + contasSel.length + cnpjsSel.length + tipos.length + formas.length + (contraparte ? 1 : 0) + (busca ? 1 : 0);
  const buscar = () => {
    // ainda não carrega nada: a tabela fica vazia de propósito
    setCarregando(true);
    setTimeout(() => setCarregando(false), 300);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title="New Extrato Bancário" subtitle={SUBTITULO} icon={Wallet} />

      {/* Filtros — tudo num card só */}
      <div className="bg-white rounded-lg shadow-lg border border-[#000638]/10 p-3 md:p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-bold text-[#000638] flex items-center gap-1.5 mr-auto">
            <FunnelSimple size={16} weight="bold" /> Filtros
            {filtrosAtivos > 0 && (
              <button onClick={limparFiltros} className="ml-2 text-xs font-normal text-blue-600 hover:underline">
                limpar ({filtrosAtivos})
              </button>
            )}
          </span>
          <button onClick={buscar} disabled={carregando || !de || !ate} className="px-4 py-1.5 text-xs rounded-lg bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-50 flex items-center gap-1 font-semibold">
            {carregando ? <ArrowsClockwise size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} {carregando ? 'Buscando…' : 'Buscar'}
          </button>
          <button disabled className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white disabled:opacity-50 flex items-center gap-1">
            <Export size={14} /> Excel
          </button>
          <button disabled className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white disabled:opacity-50 flex items-center gap-1 font-medium">
            <UploadSimple size={14} weight="bold" /> Importar extratos
          </button>
        </div>

        {/* busca */}
        <div className="relative mb-3">
          <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Pesquisar nome, CNPJ/CPF, histórico, documento ou valor…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#000638]"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* campos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-2.5">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]" />
          </div>
          <MultiSelect
            label="Banco"
            opcoes={(bancosPresentes.length ? bancosPresentes : Object.keys(BANCOS)).map((b) => ({ value: b, label: bancoCfg(b).label, banco: b }))}
            valor={bancos}
            onChange={setBancos}
            renderOpcao={(o) => (
              <span className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${bancoCfg(o.banco).ponto}`} />
                <span className="truncate">{o.label}</span>
              </span>
            )}
            larguraMin="w-full"
          />
          <SeletorCnpj contas={contasLista.filter((c) => c.qtdImportacoes > 0 && (!bancos.length || bancos.includes(c.banco)))} valor={cnpjsSel} onChange={setCnpjsSel} />
          <MultiSelect
            label="Conta"
            busca
            opcoes={contasLista
              .filter((c) => c.qtdImportacoes > 0 && (!bancos.length || bancos.includes(c.banco)))
              .filter((c) => !cnpjsSel.length || cnpjsSel.includes(docDaConta(c)))
              .map((c) => ({ value: c.id, label: c.apelido, banco: c.banco, sub: c.titular_nome }))}
            valor={contasSel}
            onChange={setContasSel}
            renderOpcao={(o) => (
              <span className="flex items-center gap-2 min-w-0">
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${bancoCfg(o.banco).ponto}`} />
                <span className="font-medium text-gray-800 shrink-0">{o.label}</span>
                {o.sub && <span className="text-gray-400 truncate">· {o.sub}</span>}
              </span>
            )}
            placeholder={contasLista.length ? 'Todas as contas' : 'Nenhuma conta importada'}
            larguraMin="w-full"
          />
          <MultiSelect
            label="Tipo"
            opcoes={[
              { value: 'ENTRADA', label: 'Entradas' },
              { value: 'SAIDA', label: 'Saídas' },
              { value: 'TRANSFERENCIA', label: 'Transferências' },
            ]}
            valor={tipos}
            onChange={setTipos}
            larguraMin="w-full"
          />
          <MultiSelect label="Forma de pagamento" busca opcoes={[]} valor={formas} onChange={setFormas} placeholder="Todas as formas" larguraMin="w-full" />
          <div className="col-span-2 lg:col-span-5">
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Fornecedor / contraparte</label>
            <input
              list="neb-contrapartes"
              value={contraparte}
              onChange={(e) => setContraparte(e.target.value)}
              placeholder="Digite para escolher…"
              className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#000638]"
            />
            <datalist id="neb-contrapartes" />
          </div>
        </div>
      </div>

      {/* Tabela — mesmo visual, sem dados por enquanto */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-200 bg-gray-50">
          <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white shadow-sm text-blue-700 border border-gray-200">Lançamentos (0)</button>
          {carregando && <ArrowsClockwise size={14} className="animate-spin text-blue-600 ml-2" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                <Th>Data</Th>
                <Th>Conta</Th>
                <Th>Tipo</Th>
                <Th>Forma</Th>
                <Th>Histórico</Th>
                <Th>Contraparte / fornecedor</Th>
                <Th>Documento</Th>
                <Th right>Entrada</Th>
                <Th right>Saída</Th>
                <Th right>Saldo após</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Info size={14} /> Página em construção: os dados ainda não são carregados aqui.
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">0 lançamentos</div>
      </div>
    </div>
  );
};

export default NewExtratoBancario;
