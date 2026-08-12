import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { toPng } from 'html-to-image';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import {
  Gavel,
  Users,
  Receipt,
  CurrencyDollar,
  CircleNotch,
  ArrowClockwise,
  Trash,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  WhatsappLogo,
  ImageSquare,
} from '@phosphor-icons/react';

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseDateNoTZ = (isoDate) => {
  if (!isoDate) return null;
  try {
    const str = String(isoDate).substring(0, 10);
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  } catch {
    return null;
  }
};

const formatDateBR = (isoDate) => {
  const d = parseDateNoTZ(isoDate);
  return d ? d.toLocaleDateString('pt-BR') : '--';
};

// Documento vem sem máscara do TOTVS (só dígitos)
const formatCpfCnpj = (doc) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc || '';
};

// Telefone do TOTVS vem sem padrão; garante o DDI 55 sem duplicar
const normalizarTelefone = (tel) => {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length > 11 && d.startsWith('55')) return d; // já veio com DDI
  return `55${d}`;
};

// Cinco redações do mesmo aviso. O WhatsApp penaliza envio em massa de
// texto idêntico, então cada disparo sorteia uma variação.
const MENSAGENS_PROTESTO = [
  ({ nome, tipoDoc, doc }) =>
    `*Alerta de PROTESTO*

Olá, ${nome}, portador do ${tipoDoc} ${doc}:

Regularize seus débitos com a CROSBY em até 24hrs, faturas seguiram para o fluxo cartorial nesse exato momento.

Caso deseje fazer a quitação hoje, digite SIM`,

  ({ nome, tipoDoc, doc }) =>
    `*Aviso de PROTESTO*

Prezado(a) ${nome}, inscrito no ${tipoDoc} ${doc}:

Seus títulos junto à CROSBY foram encaminhados agora ao fluxo de cartório. Pedimos a regularização no prazo de 24 horas.

Se quiser quitar ainda hoje, responda SIM`,

  ({ nome, tipoDoc, doc }) =>
    `*Comunicado de PROTESTO*

${nome}, ${tipoDoc} ${doc}:

As faturas em aberto com a CROSBY acabam de seguir para protesto em cartório. Regularize em até 24hrs para evitar o registro.

Para acertar o pagamento hoje, envie SIM`,

  ({ nome, tipoDoc, doc }) =>
    `*Notificação de PROTESTO*

Olá, ${nome} (${tipoDoc} ${doc}):

Informamos que suas pendências com a CROSBY foram enviadas neste momento para o fluxo cartorial. O prazo para regularizar é de 24 horas.

Quer resolver hoje? Basta digitar SIM`,

  ({ nome, tipoDoc, doc }) =>
    `*Alerta: PROTESTO em andamento*

${nome}, portador do ${tipoDoc} ${doc}:

Os débitos em aberto com a CROSBY seguiram agora para cartório. Solicitamos a regularização dentro de 24hrs.

Se desejar quitar hoje mesmo, responda com SIM`,
];

const diasAtraso = (dtVencimento) => {
  const venc = parseDateNoTZ(dtVencimento);
  if (!venc) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  return Math.floor((hoje - venc) / (1000 * 60 * 60 * 24));
};

const EsteiraProtesto = () => {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [busca, setBusca] = useState('');
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [removendoId, setRemovendoId] = useState(null);
  const [alterandoStatusId, setAlterandoStatusId] = useState(null);
  const [pessoasMap, setPessoasMap] = useState({});

  // Aviso renderizado fora da tela só para virar PNG
  const avisoRef = useRef(null);
  const [avisoCliente, setAvisoCliente] = useState(null);
  const [gerandoImagem, setGerandoImagem] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('esteira_protesto')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItens(data || []);

      // Telefone não fica gravado na esteira: busca ao vivo para o
      // WhatsApp sempre usar o contato atual do cadastro.
      const codigos = [
        ...new Set((data || []).map((i) => i.cd_cliente).filter(Boolean)),
      ];
      if (codigos.length > 0) {
        try {
          const resp = await fetch(`${TotvsURL}persons/batch-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personCodes: codigos }),
          });
          if (resp.ok) {
            const dataPessoas = await resp.json();
            setPessoasMap(dataPessoas?.data || {});
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar telefones:', err.message);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar esteira de protesto:', err);
      setNotification({
        type: 'error',
        message: `Erro ao carregar: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Alterna A protestar <-> Protestado. Atualiza o estado local antes da
  // resposta para o clique responder na hora, e desfaz se o banco recusar.
  const alternarStatus = async (item) => {
    const novoStatus =
      item.status === 'protestado' ? 'pendente' : 'protestado';
    setAlterandoStatusId(item.id);
    setItens((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: novoStatus } : i)),
    );
    try {
      const { error } = await supabaseAdmin
        .from('esteira_protesto')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      setItens((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: item.status } : i,
        ),
      );
      setNotification({
        type: 'error',
        message: `Erro ao alterar status: ${err.message}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setAlterandoStatusId(null);
    }
  };

  // Remove da esteira (envio equivocado)
  const removerItem = async (item) => {
    if (
      !confirm(
        `Remover a fatura ${item.nr_fat}/${item.nr_parcela} de ${item.nm_cliente || item.cd_cliente} da esteira?`,
      )
    )
      return;
    setRemovendoId(item.id);
    try {
      const { error } = await supabaseAdmin
        .from('esteira_protesto')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      setItens((prev) => prev.filter((i) => i.id !== item.id));
      setNotification({
        type: 'success',
        message: 'Fatura removida da esteira.',
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Erro ao remover da esteira:', err);
      setNotification({
        type: 'error',
        message: `Erro ao remover: ${err.message}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setRemovendoId(null);
    }
  };

  // Agrupamento por cliente, do maior valor total para o menor
  const clientesAgrupados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    // Busca por documento ignora a máscara: "43.496" acha "43496031000198"
    const termoDigitos = termo.replace(/\D/g, '');
    const filtrados = termo
      ? itens.filter(
          (i) =>
            (i.nm_cliente || '').toLowerCase().includes(termo) ||
            String(i.cd_cliente).includes(termo) ||
            String(i.nr_fat).includes(termo) ||
            (termoDigitos.length > 0 &&
              String(i.nr_cpfcnpj || '')
                .replace(/\D/g, '')
                .includes(termoDigitos)),
        )
      : itens;

    const mapa = {};
    filtrados.forEach((item) => {
      const key = String(item.cd_cliente);
      if (!mapa[key]) {
        mapa[key] = {
          cd_cliente: key,
          nm_cliente: item.nm_cliente || `Cliente ${key}`,
          nr_cpfcnpj: item.nr_cpfcnpj || '',
          faturas: [],
          valorTotal: 0,
        };
      }
      // Registros antigos podem não ter documento; usa o primeiro que aparecer
      if (!mapa[key].nr_cpfcnpj && item.nr_cpfcnpj) {
        mapa[key].nr_cpfcnpj = item.nr_cpfcnpj;
      }
      mapa[key].faturas.push(item);
      mapa[key].valorTotal += parseFloat(item.vl_fatura) || 0;
    });

    return Object.values(mapa)
      .map((c) => ({
        ...c,
        faturas: [...c.faturas].sort(
          (a, b) =>
            (parseDateNoTZ(a.dt_vencimento) || 0) -
            (parseDateNoTZ(b.dt_vencimento) || 0),
        ),
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal);
  }, [itens, busca]);

  const totais = useMemo(() => {
    const valorTotal = itens.reduce(
      (a, i) => a + (parseFloat(i.vl_fatura) || 0),
      0,
    );
    return {
      clientes: new Set(itens.map((i) => String(i.cd_cliente))).size,
      faturas: itens.length,
      valorTotal,
    };
  }, [itens]);

  const toggleCliente = (cd) =>
    setClientesExpandidos((prev) => ({ ...prev, [cd]: !prev[cd] }));

  const telefoneCliente = (cdCliente) =>
    pessoasMap[String(cdCliente).trim()]?.phone || '';

  // Abre o WhatsApp Web/app com a mensagem pronta — o operador revisa
  // e envia manualmente. Nada é disparado automaticamente daqui.
  const abrirWhatsApp = (cliente) => {
    const telefone = normalizarTelefone(telefoneCliente(cliente.cd_cliente));
    if (!telefone) {
      setNotification({
        type: 'error',
        message: 'Telefone não encontrado no cadastro deste cliente.',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const digitos = String(cliente.nr_cpfcnpj || '').replace(/\D/g, '');
    const variacao =
      MENSAGENS_PROTESTO[Math.floor(Math.random() * MENSAGENS_PROTESTO.length)];
    const mensagem = variacao({
      nome: cliente.nm_cliente,
      tipoDoc: digitos.length === 11 ? 'CPF' : 'CNPJ',
      doc: formatCpfCnpj(cliente.nr_cpfcnpj) || 'não informado',
    });

    window.open(
      `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`,
      '_blank',
    );
  };

  // Gera o PNG do aviso: monta o nó escondido, espera o React pintar,
  // rasteriza com html-to-image e dispara o download.
  const baixarImagem = async (cliente) => {
    setGerandoImagem(cliente.cd_cliente);
    setAvisoCliente(cliente);
    try {
      // Dois frames: um para o React montar o nó, outro para o layout assentar
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      if (!avisoRef.current) throw new Error('falha ao montar o aviso');

      // Mesmas opções dos cards do Forecast (useDownloadAsImage)
      const dataUrl = await toPng(avisoRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        cacheBust: true,
        quality: 1,
        skipFonts: false,
        style: { boxShadow: 'none', transform: 'none' },
      });

      const link = document.createElement('a');
      const docLimpo = String(cliente.nr_cpfcnpj || cliente.cd_cliente).replace(
        /\D/g,
        '',
      );
      link.download = `aviso-protesto-${docLimpo}.png`;
      link.href = dataUrl;
      link.click();

      setNotification({
        type: 'success',
        message: 'Imagem gerada. Confira a pasta de downloads.',
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      setNotification({
        type: 'error',
        message: `Erro ao gerar a imagem: ${err.message}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setGerandoImagem(null);
      setAvisoCliente(null);
    }
  };

  // Copia só os dígitos — é o formato aceito nos sistemas do banco
  const copiarDocumento = async (doc) => {
    const digitos = String(doc || '').replace(/\D/g, '');
    if (!digitos) return;
    try {
      await navigator.clipboard.writeText(digitos);
      setNotification({
        type: 'success',
        message: `Documento ${formatCpfCnpj(digitos)} copiado.`,
      });
      setTimeout(() => setNotification(null), 2500);
    } catch {
      setNotification({
        type: 'error',
        message: 'Não foi possível copiar o documento.',
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-6">
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <PageTitle
        title="Esteira de Protesto"
        subtitle="Faturas encaminhadas da Inadimplência Multimarcas para protesto em cartório"
        icon={Gavel}
        iconColor="text-red-700"
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Clientes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-[#000638]">
              {loading ? (
                <CircleNotch size={22} className="animate-spin" />
              ) : (
                totais.clientes
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Clientes com fatura na esteira
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-red-700" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Faturas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-red-700">
              {loading ? (
                <CircleNotch size={22} className="animate-spin" />
              ) : (
                totais.faturas
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Títulos aguardando protesto
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={18} className="text-red-700" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Valor Total
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-red-700">
              {loading ? (
                <CircleNotch size={22} className="animate-spin" />
              ) : (
                formatCurrency(totais.valorTotal)
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Soma das faturas na esteira
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Busca + atualizar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, código, CNPJ/CPF ou nº da fatura..."
            className="border border-[#000638]/30 rounded-lg pl-9 pr-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
          />
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="flex items-center justify-center gap-1 bg-[#000638] text-white px-3 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 font-bold transition-colors text-xs uppercase tracking-wide shadow-md"
        >
          {loading ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : (
            <ArrowClockwise size={16} />
          )}
          Atualizar
        </button>
      </div>

      {/* Lista agrupada por cliente */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <CircleNotch size={32} className="animate-spin text-[#000638]" />
        </div>
      ) : clientesAgrupados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-10 text-center text-sm text-gray-500">
          {busca
            ? 'Nenhum resultado para a busca.'
            : 'Nenhuma fatura na esteira. Envie faturas pelo botão "Protestar" na Inadimplência Multimarcas.'}
        </div>
      ) : (
        <div className="space-y-3">
          {clientesAgrupados.map((cliente) => {
            const expandido = clientesExpandidos[cliente.cd_cliente] !== false;
            return (
              <div
                key={cliente.cd_cliente}
                className="bg-white rounded-lg shadow-sm border overflow-hidden"
              >
                {/* Cabeçalho do cliente */}
                <button
                  onClick={() => toggleCliente(cliente.cd_cliente)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-left">
                    {expandido ? (
                      <CaretDown size={16} className="text-gray-400" />
                    ) : (
                      <CaretRight size={16} className="text-gray-400" />
                    )}
                    <div>
                      <div className="font-bold text-sm text-[#000638]">
                        {cliente.nm_cliente}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                        <span>Cód. {cliente.cd_cliente}</span>
                        <span className="text-gray-300">|</span>
                        {cliente.nr_cpfcnpj ? (
                          <span
                            className="font-semibold text-[#000638] bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200 transition-colors"
                            title="Clique para copiar"
                            onClick={(e) => {
                              e.stopPropagation();
                              copiarDocumento(cliente.nr_cpfcnpj);
                            }}
                          >
                            {formatCpfCnpj(cliente.nr_cpfcnpj)}
                          </span>
                        ) : (
                          <span className="italic">
                            documento não informado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {cliente.faturas.length} fatura(s)
                    </span>
                    <span className="font-extrabold text-sm text-red-700">
                      {formatCurrency(cliente.valorTotal)}
                    </span>
                    {/* Ação por cliente: a mensagem é sobre o cadastro
                        inteiro, não sobre uma fatura específica */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirWhatsApp(cliente);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          abrirWhatsApp(cliente);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                        telefoneCliente(cliente.cd_cliente)
                          ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      title={
                        telefoneCliente(cliente.cd_cliente)
                          ? 'Abrir WhatsApp com o alerta de protesto'
                          : 'Telefone não encontrado no cadastro'
                      }
                    >
                      <WhatsappLogo size={14} weight="bold" />
                      Avisar
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        baixarImagem(cliente);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          baixarImagem(cliente);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors bg-[#000638] hover:bg-[#fe0000] text-white cursor-pointer"
                      title="Baixar aviso de protesto em PNG para enviar ao cliente"
                    >
                      {gerandoImagem === cliente.cd_cliente ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <ImageSquare size={14} weight="bold" />
                      )}
                      Imagem
                    </span>
                  </div>
                </button>

                {/* Faturas do cliente */}
                {expandido && (
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#000638] text-white">
                          <th className="px-3 py-2 text-left font-semibold">
                            Empresa
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Fatura
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Emissão
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Vencimento
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Atraso
                          </th>
                          <th className="px-3 py-2 text-right font-semibold">
                            Valor
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Portador
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Enviado por
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Enviado em
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Status
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cliente.faturas.map((item) => {
                          const atraso = diasAtraso(item.dt_vencimento);
                          return (
                            <tr
                              key={item.id}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2">{item.cd_empresa}</td>
                              <td className="px-3 py-2 font-semibold text-[#000638]">
                                {item.nr_fat}/{item.nr_parcela}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {formatDateBR(item.dt_emissao)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {formatDateBR(item.dt_vencimento)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {atraso > 0 ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      atraso > 60
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {atraso} dias
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                                    A vencer
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {formatCurrency(
                                  parseFloat(item.vl_fatura) || 0,
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.nm_portador || '--'}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.user_nome || item.user_email || '--'}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600">
                                {item.created_at
                                  ? new Date(
                                      item.created_at,
                                    ).toLocaleDateString('pt-BR')
                                  : '--'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {(() => {
                                  const protestado =
                                    item.status === 'protestado';
                                  const salvando = alterandoStatusId === item.id;
                                  return (
                                    <button
                                      onClick={() => alternarStatus(item)}
                                      disabled={salvando}
                                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors disabled:opacity-60 ${
                                        protestado
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                                      }`}
                                      title={
                                        protestado
                                          ? 'Protestado — clique para voltar para A protestar'
                                          : 'A protestar — clique quando protestar em cartório'
                                      }
                                    >
                                      {salvando && (
                                        <CircleNotch
                                          size={10}
                                          className="animate-spin"
                                        />
                                      )}
                                      {protestado
                                        ? 'Protestado'
                                        : 'A protestar'}
                                    </button>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => removerItem(item)}
                                  disabled={removendoId === item.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                                  title="Remover da esteira"
                                >
                                  {removendoId === item.id ? (
                                    <CircleNotch
                                      size={11}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash size={11} weight="bold" />
                                  )}
                                  Remover
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comprovante renderizado fora da tela para virar PNG. Posicionado
          (não display:none) porque o html-to-image precisa do nó com
          layout calculado. */}
      {avisoCliente && (
        <div
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div
            ref={avisoRef}
            style={{
              width: '1000px',
              background: '#ffffff',
              fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
              padding: '28px',
              boxSizing: 'border-box',
            }}
          >
            {/* Faixa de confirmação — assinada pela Crosby, que é quem
                comandou o protesto e emite este comprovante */}
            <div
              style={{
                border: '1px solid #b7d9a1',
                background: '#eef7e7',
                borderRadius: '8px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  background: '#4caf50',
                  borderRadius: '5px',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '9px',
                    top: '4px',
                    width: '8px',
                    height: '15px',
                    border: 'solid #ffffff',
                    borderWidth: '0 3px 3px 0',
                    transform: 'rotate(45deg)',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 'bold',
                  color: '#2f2f2f',
                }}
              >
                Comando de Instrução executado com sucesso!
                {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '34px',
                  color: '#76b83f',
                  letterSpacing: '0.3px',
                }}
              >
                Instruções de Protesto
              </div>
            </div>

            <div
              style={{
                border: '1px solid #dcdcdc',
                borderRadius: '6px',
                padding: '22px',
              }}
            >
              {avisoCliente.faturas.map((f, idx) => {
                const nroDoc = `${f.nr_fat}/${String(f.nr_parcela).padStart(3, '0')}`;
                const linha = (rotulo, valor) => (
                  <div
                    style={{
                      display: 'flex',
                      marginBottom: '11px',
                      fontSize: '15px',
                    }}
                  >
                    <div
                      style={{
                        width: '290px',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: '#555555',
                        paddingRight: '16px',
                        flexShrink: 0,
                      }}
                    >
                      {rotulo}
                    </div>
                    <div style={{ color: '#7d7d7d' }}>{valor}</div>
                  </div>
                );

                return (
                  <div
                    key={f.id}
                    style={{
                      marginBottom:
                        idx === avisoCliente.faturas.length - 1 ? 0 : '22px',
                    }}
                  >
                    <div
                      style={{
                        background: '#5da82c',
                        color: '#ffffff',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        padding: '11px 16px',
                      }}
                    >
                      Pagador {avisoCliente.nm_cliente} - Nro. Doc {nroDoc}
                    </div>
                    <div
                      style={{
                        border: '1px solid #e8e8e8',
                        borderTop: 'none',
                        padding: '22px 20px',
                      }}
                    >
                      {linha('Pagador:', avisoCliente.nm_cliente)}
                      {linha('Número do Documento:', nroDoc)}
                      {linha('Nosso número:', f.nosso_numero || '--')}
                      {linha('Vencimento:', formatDateBR(f.dt_vencimento))}
                      {linha(
                        'Valor:',
                        formatCurrency(parseFloat(f.vl_fatura) || 0),
                      )}
                      {linha('Instrução:', 'Pedido de Protesto')}
                      <div style={{ display: 'flex', fontSize: '15px' }}>
                        <div
                          style={{
                            width: '290px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            color: '#555555',
                            paddingRight: '16px',
                            flexShrink: 0,
                          }}
                        >
                          Status:
                        </div>
                        <div style={{ color: '#7d7d7d' }}>
                          Protesto comandado em{' '}
                          {new Date().toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: '16px',
                fontSize: '11px',
                color: '#9ca3af',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EsteiraProtesto;
