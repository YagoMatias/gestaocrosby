// Envio de Remessa — faturas a vencer das filiais selecionadas, já com o
// cadastro do cliente que a Pagar.me exige para emitir boleto (CPF/CNPJ,
// endereço completo, telefone, e-mail). Base para o envio dos boletos:
// por enquanto só lista e aponta os cadastros incompletos. O "olhinho" abre o
// cadastro do cliente e permite corrigir endereço/contato direto no TOTVS.
// "Gerar remessa" emite o boleto na Pagar.me das faturas elegíveis (portador
// em carteira, cadastro completo, sem boleto Pagar.me): a partir daí a fatura
// aparece aqui com o portador PAGARME e, no TOTVS, com a carteira Simples.
import React, { useMemo, useState } from 'react';
import {
  Barcode,
  MagnifyingGlass,
  Spinner,
  Warning,
  CheckCircle,
  Eye,
  X,
  FloppyDisk,
  PaperPlaneTilt,
  FileXls,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { useAuth } from '../components/AuthContext';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const chaveDe = (f) => `${f.cd_empresa}-${f.nr_fatura}-${f.nr_parcela}`;

// Faturas por chamada de emissão — mantém cada requisição curta e dá progresso.
const LOTE_REMESSA = 10;

const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoMais = (dias) =>
  new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

function fmtBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s) {
  if (!s) return '—';
  const [a, m, d] = String(s).slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : s;
}

function fmtDoc(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return s || '—';
}

function fmtFone(s) {
  const d = String(s || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return s || '—';
}

const CARTEIRA = { 0: 'Não está em cobrança', 1: 'Simples', 2: 'Descontada' };
const fmtCarteira = (tp) => (tp == null ? '—' : CARTEIRA[tp] || `Tipo ${tp}`);

const inputCls =
  'border border-gray-300 rounded-lg px-2 py-1.5 w-full text-xs disabled:bg-gray-100 disabled:text-gray-600';

function Campo({ label, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold mb-0.5 text-[#000638]">{label}</label>
      <input className={inputCls} {...props} />
    </div>
  );
}

// Detalhe do cadastro do cliente (CPF/CNPJ, endereço, contato). "Salvar"
// grava a alteração no TOTVS e devolve o cadastro relido de lá.
function ModalCliente({ cliente, onClose, onSalvo }) {
  const [form, setForm] = useState({
    ...(cliente.endereco || {}),
    telefone: fmtFone(cliente.telefone).replace('—', ''),
    email: cliente.email || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const pend = cliente.pendencias || [];

  const set = (k) => (e) => {
    setOk(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    setOk(false);
    try {
      const { telefone, email, ...endereco } = form;
      const resp = await fetch(`${TotvsURL}remessa-boletos/cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: cliente.codigo,
          tipo: cliente.tipo,
          endereco,
          telefone,
          email,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }
      onSalvo(json.data.cliente);
      setOk(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-gray-200">
          <div>
            <div className="text-sm font-bold text-[#000638]">
              {cliente.codigo} - {cliente.nome}
            </div>
            {cliente.fantasia && cliente.fantasia !== cliente.nome && (
              <div className="text-xs text-gray-500">{cliente.fantasia}</div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-[#fe0000]">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {pend.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              <Warning size={14} weight="fill" /> Falta para emitir boleto: {pend.join(', ')}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <Campo
              label={cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF'}
              className="sm:col-span-3"
              value={fmtDoc(cliente.documento)}
              disabled
              readOnly
            />
            <Campo
              label="Telefone (com DDD)"
              className="sm:col-span-3"
              value={form.telefone}
              onChange={set('telefone')}
            />
            <Campo
              label="E-mail"
              className="sm:col-span-6"
              value={form.email}
              onChange={set('email')}
            />
            <Campo label="CEP" className="sm:col-span-2" value={form.cep || ''} onChange={set('cep')} />
            <Campo
              label="Logradouro"
              className="sm:col-span-3"
              value={form.logradouro || ''}
              onChange={set('logradouro')}
            />
            <Campo
              label="Número"
              className="sm:col-span-1"
              value={form.numero || ''}
              onChange={set('numero')}
            />
            <Campo
              label="Complemento"
              className="sm:col-span-3"
              value={form.complemento || ''}
              onChange={set('complemento')}
            />
            <Campo
              label="Bairro"
              className="sm:col-span-3"
              value={form.bairro || ''}
              onChange={set('bairro')}
            />
            <Campo
              label="Cidade"
              className="sm:col-span-5"
              value={form.cidade || ''}
              onChange={set('cidade')}
            />
            <Campo
              label="UF"
              className="sm:col-span-1"
              maxLength={2}
              value={form.uf || ''}
              onChange={set('uf')}
            />
          </div>

          {erro && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <Warning size={14} weight="fill" /> {erro}
            </div>
          )}
          {ok && (
            <div className="flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle size={14} weight="fill" /> Cadastro atualizado no TOTVS.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="text-xs font-semibold rounded-lg px-3 py-2 border border-gray-300 hover:bg-gray-50"
          >
            Fechar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-60"
          >
            {salvando ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <FloppyDisk size={14} weight="bold" />
            )}
            {salvando ? 'Salvando...' : 'Salvar no TOTVS'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RemessaBoletos() {
  const { user } = useAuth();
  const [portadoresRemessa, setPortadoresRemessa] = useState([1020, 1098]);
  const [tabelaAusente, setTabelaAusente] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [resultado, setResultado] = useState(null);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState(isoHoje());
  const [dataFim, setDataFim] = useState(isoMais(30));
  const [busca, setBusca] = useState('');
  const [filtroPortador, setFiltroPortador] = useState('todos');
  // todos | enviado (boleto Pagar.me vivo) | pendente (última tentativa falhou) | nao_enviado
  const [filtroEnvio, setFiltroEnvio] = useState('todos');
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [faturas, setFaturas] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  // Cadastro salvo no TOTVS → reflete em todas as faturas do mesmo cliente
  const aoSalvarCliente = (cliente) => {
    setFaturas((atual) =>
      (atual || []).map((f) =>
        Number(f.cd_cliente) === Number(cliente.codigo) ? { ...f, cliente } : f,
      ),
    );
    setDetalhe(cliente);
  };

  const nomeEmpresa = useMemo(() => {
    const m = {};
    for (const e of empresasSelecionadas) m[String(e.cd_empresa)] = e.nm_grupoempresa;
    return m;
  }, [empresasSelecionadas]);

  const buscar = async () => {
    if (empresasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma empresa.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams({
        branches: empresasSelecionadas.map((e) => e.cd_empresa).join(','),
        dt_inicio: dataInicio,
        dt_fim: dataFim,
      });
      const resp = await fetch(`${TotvsURL}remessa-boletos/faturas?${params}`);
      const json = await resp.json();
      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }
      setFaturas(json.data?.items || []);
      setSelecionadas(new Set());
      setTabelaAusente(Boolean(json.data?.tabelaAusente));
      if (json.data?.portadoresRemessa) setPortadoresRemessa(json.data.portadoresRemessa);
    } catch (e) {
      setErro(`Erro ao buscar faturas: ${e.message}`);
      setFaturas(null);
    } finally {
      setLoading(false);
    }
  };

  // Opções do filtro de portador: os que existem na busca + "PAGARME" (já enviados)
  const portadores = useMemo(() => {
    const m = new Map();
    let temPagarme = false;
    for (const f of faturas || []) {
      if (f.pagarme) temPagarme = true;
      else if (f.cd_portador != null) m.set(String(f.cd_portador), f.nm_portador || '');
    }
    const lista = [...m.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([cd, nm]) => ({ valor: cd, label: `${cd} - ${nm}` }));
    if (temPagarme) lista.unshift({ valor: 'PAGARME', label: 'PAGARME (boleto emitido)' });
    return lista;
  }, [faturas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (faturas || []).filter((f) => {
      if (filtroEnvio === 'enviado' && !f.pagarme) return false;
      if (filtroEnvio === 'pendente' && !(f.ultimo_erro && !f.pagarme)) return false;
      if (filtroEnvio === 'nao_enviado' && (f.pagarme || f.ultimo_erro)) return false;
      if (filtroPortador === 'PAGARME' && !f.pagarme) return false;
      if (filtroPortador !== 'todos' && filtroPortador !== 'PAGARME') {
        if (f.pagarme || String(f.cd_portador) !== filtroPortador) return false;
      }
      if (!q) return true;
      return [f.cliente?.nome, f.cliente?.fantasia, f.cliente?.documento, f.cd_cliente, f.nr_fatura, f.cd_portador, f.nm_portador]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [faturas, busca, filtroPortador, filtroEnvio]);

  // Entram na remessa: portador "em carteira", cadastro completo e sem boleto Pagar.me
  const elegiveis = useMemo(
    () =>
      visiveis.filter(
        (f) =>
          portadoresRemessa.includes(Number(f.cd_portador)) &&
          !f.pagarme &&
          !(f.cliente?.pendencias?.length),
      ),
    [visiveis, portadoresRemessa],
  );
  const valorElegivel = elegiveis.reduce((s, f) => s + Number(f.vl_fatura || 0), 0);

  // Só vai para a Pagar.me o que estiver elegível E marcado
  const paraEnviar = useMemo(
    () => elegiveis.filter((f) => selecionadas.has(chaveDe(f))),
    [elegiveis, selecionadas],
  );
  const valorEnviar = paraEnviar.reduce((s, f) => s + Number(f.vl_fatura || 0), 0);
  const todasMarcadas = elegiveis.length > 0 && paraEnviar.length === elegiveis.length;

  const alternar = (f) =>
    setSelecionadas((atual) => {
      const n = new Set(atual);
      const k = chaveDe(f);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const alternarTodas = () =>
    setSelecionadas((atual) => {
      const n = new Set(atual);
      if (todasMarcadas) elegiveis.forEach((f) => n.delete(chaveDe(f)));
      else elegiveis.forEach((f) => n.add(chaveDe(f)));
      return n;
    });

  const baixarExcel = () => {
    const linhas = visiveis.map((f) => {
      const c = f.cliente || {};
      const e = c.endereco || {};
      return {
        Empresa: f.cd_empresa,
        'Nome empresa': nomeEmpresa[String(f.cd_empresa)] || '',
        'Cód. cliente': f.cd_cliente,
        Cliente: c.nome || '',
        'Nome fantasia': c.fantasia || '',
        'CPF/CNPJ': c.documento || '',
        Telefone: c.telefone || '',
        'E-mail': c.email || '',
        Endereço: [e.logradouro, e.numero].filter(Boolean).join(', '),
        Complemento: e.complemento || '',
        Bairro: e.bairro || '',
        Cidade: e.cidade || '',
        UF: e.uf || '',
        CEP: e.cep || '',
        Fatura: f.nr_fatura,
        Parcela: f.nr_parcela,
        Emissão: fmtData(f.dt_emissao),
        Vencimento: fmtData(f.dt_vencimento),
        Valor: Number(f.vl_fatura || 0),
        Portador: f.pagarme ? 'PAGARME' : f.cd_portador ?? '',
        'Nome portador': f.pagarme ? 'Pagar.me (boleto emitido)' : f.nm_portador || '',
        'Portador TOTVS': f.cd_portador ?? '',
        Carteira: fmtCarteira(f.tp_cobranca),
        'Boleto no banco': f.boleto_registrado ? 'Sim' : 'Não',
        'Linha digitável Pagar.me': f.pagarme?.linha_digitavel || '',
        Cadastro: c.pendencias?.length ? `Falta ${c.pendencias.join(', ')}` : 'OK',
        'Elegível remessa': elegiveis.includes(f) ? 'Sim' : 'Não',
        Selecionada: selecionadas.has(chaveDe(f)) ? 'Sim' : 'Não',
        Envio: f.pagarme ? 'Enviado' : f.ultimo_erro ? 'Pendente' : 'Não enviado',
        'Erro do envio': f.pagarme ? '' : f.ultimo_erro?.descricao || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Envio de Remessa');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `envio-remessa-${dataInicio}_${dataFim}.xlsx`,
    );
  };

  const gerarRemessa = async (lista = paraEnviar) => {
    if (lista.length === 0) return;
    const valorLista = lista.reduce((t, f) => t + Number(f.vl_fatura || 0), 0);
    if (
      !window.confirm(
        `Gerar remessa de ${lista.length} boleto(s) selecionado(s) na Pagar.me?\n\n` +
          `Valor total: ${fmtBRL(valorLista)}\n` +
          `Portadores: ${portadoresRemessa.join(', ')}\n\n` +
          'Os boletos são emitidos de verdade e a carteira das faturas passa a Simples no TOTVS.',
      )
    )
      return;

    setGerando(true);
    setResultado(null);
    setErro('');
    const remessaId = `R${Date.now()}`;
    const todos = [];
    try {
      for (let i = 0; i < lista.length; i += LOTE_REMESSA) {
        const lote = lista.slice(i, i + LOTE_REMESSA);
        setProgresso(`${Math.min(i + lote.length, lista.length)}/${lista.length}`);
        const resp = await fetch(`${TotvsURL}remessa-boletos/gerar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            remessaId,
            usuario: user?.email || user?.name || null,
            faturas: lote.map((f) => ({
              cd_empresa: f.cd_empresa,
              cd_cliente: f.cd_cliente,
              nr_fatura: f.nr_fatura,
              nr_parcela: f.nr_parcela,
            })),
          }),
        });
        const json = await resp.json();
        if (!resp.ok || json.success === false) {
          throw new Error(json.message || `HTTP ${resp.status}`);
        }
        todos.push(...(json.data?.resultados || []));
      }
    } catch (e) {
      setErro(`Remessa interrompida: ${e.message}`);
    } finally {
      setResultado({
        emitidos: todos.filter((r) => r.ok).length,
        falhas: todos.filter((r) => !r.ok),
        carteira: todos.filter((r) => r.ok && r.carteiraErro),
      });
      setGerando(false);
      setProgresso('');
      buscar();
    }
  };

  const valorTotal = visiveis.reduce((s, f) => s + Number(f.vl_fatura || 0), 0);
  const enviadas = (faturas || []).filter((f) => f.pagarme).length;
  const pendentesErro = (faturas || []).filter((f) => f.ultimo_erro && !f.pagarme).length;
  const comPendencia = visiveis.filter((f) => f.cliente?.pendencias?.length).length;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
      <PageTitle
        title="Envio de Remessa"
        subtitle="Faturas a vencer das filiais para emissão de boleto na Pagar.me"
        icon={Barcode}
        iconColor="text-green-600"
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-center">
          <div className="lg:col-span-2">
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={setEmpresasSelecionadas}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Vencimento de
            </label>
            <input
              type="date"
              value={dataInicio}
              min={isoHoje()}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Vencimento até
            </label>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            />
          </div>
          <button
            onClick={buscar}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-60 lg:mt-4"
          >
            {loading ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={14} weight="bold" />
            )}
            {loading ? 'Buscando...' : 'Buscar faturas'}
          </button>
        </div>
        {erro && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <Warning size={14} weight="fill" /> {erro}
          </div>
        )}
      </div>

      {faturas && (
        <>
          {tabelaAusente && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              <Warning size={14} weight="fill" /> A tabela pagarme_boletos ainda não existe no
              Supabase — rode a migration antes de gerar a remessa.
            </div>
          )}

          {resultado && (
            <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-green-700">
                <CheckCircle size={14} weight="fill" /> {resultado.emitidos} boleto(s) emitido(s)
                na Pagar.me
              </div>
              {resultado.carteira.length > 0 && (
                <div className="mt-1 text-amber-700">
                  Boleto emitido, mas a carteira não mudou no TOTVS:
                  <ul className="list-disc ml-5">
                    {resultado.carteira.map((r) => (
                      <li key={r.chave}>
                        {r.chave}: {r.carteiraErro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resultado.falhas.length > 0 && (
                <div className="mt-1 text-red-600">
                  {resultado.falhas.length} fatura(s) sem boleto:
                  <ul className="list-disc ml-5">
                    {resultado.falhas.map((r) => (
                      <li key={r.chave} title={r.motivo}>
                        {r.chave}: {r.descricao || r.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">Faturas a vencer</div>
              <div className="text-lg font-bold text-[#000638]">{visiveis.length}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">Valor total</div>
              <div className="text-lg font-bold text-green-700">{fmtBRL(valorTotal)}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">
                Elegíveis p/ remessa (portador {portadoresRemessa.join(', ')})
              </div>
              <div className="text-lg font-bold text-[#000638]">
                {elegiveis.length}{' '}
                <span className="text-xs font-semibold text-gray-500">{fmtBRL(valorElegivel)}</span>
              </div>
            </div>
            <button
              onClick={() => setFiltroEnvio(filtroEnvio === 'enviado' ? 'todos' : 'enviado')}
              className={`text-left bg-white rounded-lg border p-3 ${
                filtroEnvio === 'enviado' ? 'border-[#000638] ring-1 ring-[#000638]' : 'border-gray-200'
              }`}
            >
              <div className="text-[11px] text-gray-500">Enviadas (boleto Pagar.me)</div>
              <div className="text-lg font-bold text-green-700">{enviadas}</div>
            </button>
            <button
              onClick={() => setFiltroEnvio(filtroEnvio === 'pendente' ? 'todos' : 'pendente')}
              className={`text-left bg-white rounded-lg border p-3 ${
                filtroEnvio === 'pendente' ? 'border-[#000638] ring-1 ring-[#000638]' : 'border-gray-200'
              }`}
            >
              <div className="text-[11px] text-gray-500">Pendentes (erro no envio)</div>
              <div className={`text-lg font-bold ${pendentesErro ? 'text-red-600' : 'text-gray-400'}`}>
                {pendentesErro}
              </div>
            </button>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">Cadastro incompleto p/ boleto</div>
              <div
                className={`text-lg font-bold ${comPendencia ? 'text-amber-600' : 'text-gray-400'}`}
              >
                {comPendencia}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-2 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por cliente, CPF/CNPJ ou nº da fatura"
                className="border border-gray-300 rounded-lg px-2 py-1.5 w-full sm:w-72 text-xs"
              />
              <select
                value={filtroPortador}
                onChange={(e) => setFiltroPortador(e.target.value)}
                title="Filtrar por portador"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:w-64"
              >
                <option value="todos">Todos os portadores</option>
                {portadores.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={filtroEnvio}
                onChange={(e) => setFiltroEnvio(e.target.value)}
                title="Filtrar pela situação do envio à Pagar.me"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:w-48"
              >
                <option value="todos">Envio: todos</option>
                <option value="enviado">Enviado</option>
                <option value="pendente">Pendente (erro)</option>
                <option value="nao_enviado">Não enviado</option>
              </select>
              <span className="text-[11px] text-gray-500 flex-1">
                {paraEnviar.length} selecionada(s) · {fmtBRL(valorEnviar)}
              </span>
              <button
                onClick={baixarExcel}
                disabled={visiveis.length === 0}
                title="Exporta as faturas da tela para Excel"
                className="flex items-center gap-1.5 bg-white text-[#000638] border border-[#000638]/30 text-xs font-semibold rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <FileXls size={14} weight="bold" /> Baixar Excel
              </button>
              <button
                onClick={gerarRemessa}
                disabled={gerando || loading || tabelaAusente || paraEnviar.length === 0}
                title={`Emite boleto na Pagar.me para as faturas dos portadores ${portadoresRemessa.join(', ')}`}
                className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                {gerando ? (
                  <Spinner size={14} className="animate-spin" />
                ) : (
                  <PaperPlaneTilt size={14} weight="bold" />
                )}
                {gerando ? `Gerando ${progresso}...` : `Gerar remessa (${paraEnviar.length})`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#000638] text-white">
                  <tr>
                    <th className="px-2 py-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={todasMarcadas}
                        disabled={elegiveis.length === 0}
                        onChange={alternarTodas}
                        title="Marcar/desmarcar todas as elegíveis da tela"
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-2 py-2 text-left">Empresa</th>
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">Nome fantasia</th>
                    <th className="px-2 py-2 text-left">Fatura</th>
                    <th className="px-2 py-2 text-left">Emissão</th>
                    <th className="px-2 py-2 text-left">Vencimento</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-left">Portador</th>
                    <th className="px-2 py-2 text-left">Carteira</th>
                    <th className="px-2 py-2 text-left">Cadastro</th>
                    <th className="px-2 py-2 text-left">Envio</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-2 py-6 text-center text-gray-500">
                        Nenhuma fatura a vencer no período.
                      </td>
                    </tr>
                  )}
                  {visiveis.map((f) => {
                    const c = f.cliente || {};
                    const pend = c.pendencias || [];
                    const elegivel = elegiveis.includes(f);
                    const marcada = selecionadas.has(chaveDe(f));
                    const motivo = f.pagarme
                      ? 'Já tem boleto Pagar.me'
                      : !portadoresRemessa.includes(Number(f.cd_portador))
                        ? `Portador ${f.cd_portador} não entra na remessa`
                        : pend.length
                          ? `Cadastro incompleto: ${pend.join(', ')}`
                          : '';
                    return (
                      <tr
                        key={chaveDe(f)}
                        onClick={() => elegivel && alternar(f)}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          marcada ? 'bg-green-50' : ''
                        } ${elegivel ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={!elegivel}
                            onChange={() => alternar(f)}
                            title={motivo || 'Enviar esta fatura na remessa'}
                            className="cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td
                          className="px-2 py-1.5 whitespace-nowrap"
                          title={nomeEmpresa[String(f.cd_empresa)] || ''}
                        >
                          {f.cd_empresa}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-gray-500">{f.cd_cliente} - </span>
                          <span className="font-semibold text-[#000638]">{c.nome || '—'}</span>
                        </td>
                        <td className="px-2 py-1.5">{c.fantasia || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {f.nr_fatura}/{f.nr_parcela}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(f.dt_emissao)}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(f.dt_vencimento)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                          {fmtBRL(f.vl_fatura)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {f.pagarme ? (
                            <span
                              className="inline-block bg-green-100 text-green-800 font-semibold rounded px-1.5 py-0.5"
                              title={`Boleto Pagar.me emitido. No TOTVS o portador segue ${f.cd_portador} - ${f.nm_portador || ''}`}
                            >
                              PAGARME
                            </span>
                          ) : (
                            <>
                              {f.cd_portador ?? '—'}
                              {f.nm_portador ? ` - ${f.nm_portador}` : ''}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {fmtCarteira(f.tp_cobranca)}
                          {f.boleto_registrado && (
                            <span
                              className="ml-1 text-[10px] text-blue-600"
                              title={`Boleto já registrado no portador — nosso número ${f.nosso_numero ?? ''}`}
                            >
                              (boleto)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {pend.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle size={13} weight="fill" /> OK
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-amber-600"
                                title={`Falta: ${pend.join(', ')}`}
                              >
                                <Warning size={13} weight="fill" /> Incompleto
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetalhe(c);
                              }}
                              disabled={!c.tipo}
                              title="Ver / alterar cadastro do cliente"
                              className="text-[#000638] hover:text-[#fe0000] disabled:opacity-30"
                            >
                              <Eye size={16} weight="bold" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 max-w-[320px]">
                          {f.pagarme ? (
                            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                              <CheckCircle size={13} weight="fill" /> Enviado
                            </span>
                          ) : f.ultimo_erro ? (
                            <div className="flex items-start gap-2">
                              <div>
                                <span
                                  className="inline-flex items-center gap-1 text-red-600 font-semibold"
                                  title={`Erro técnico: ${f.ultimo_erro.tecnico || ''}`}
                                >
                                  <Warning size={13} weight="fill" /> Pendente
                                </span>
                                <div className="text-[11px] text-gray-700">{f.ultimo_erro.descricao}</div>
                                <div className="text-[10px] text-gray-400">
                                  tentativa em {fmtData(f.ultimo_erro.quando)}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gerarRemessa([f]);
                                }}
                                disabled={gerando || !elegivel}
                                title={elegivel ? 'Reenviar esta fatura à Pagar.me' : motivo}
                                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#000638] border border-[#000638]/30 rounded px-1.5 py-0.5 hover:bg-gray-50 disabled:opacity-40"
                              >
                                <ArrowCounterClockwise size={12} weight="bold" /> Reenviar
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!faturas && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[60vh] flex flex-col items-center justify-center text-center text-gray-500 p-6">
          {loading ? (
            <>
              <Spinner size={28} className="animate-spin text-[#000638] mb-2" />
              <div className="text-sm">Buscando faturas no TOTVS...</div>
            </>
          ) : (
            <>
              <Barcode size={40} weight="duotone" className="text-gray-300 mb-2" />
              <div className="text-sm font-semibold text-[#000638]">
                Selecione a empresa e o período de vencimento e clique em Buscar faturas
              </div>
              <div className="text-xs mt-1">
                As faturas a vencer aparecem aqui com o cadastro do cliente e a situação do envio.
              </div>
            </>
          )}
        </div>
      )}

      {detalhe && (
        <ModalCliente
          key={detalhe.codigo}
          cliente={detalhe}
          onClose={() => setDetalhe(null)}
          onSalvo={aoSalvarCliente}
        />
      )}
    </div>
  );
}
