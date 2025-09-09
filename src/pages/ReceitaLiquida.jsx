import React, { useEffect, useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';

const ReceitaLiquida = () => {
  const apiClient = useApiClient();
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Totais gerais
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalLiquido, setTotalLiquido] = useState(0);
  const [totalIcms, setTotalIcms] = useState(0);
  const [totalDesconto, setTotalDesconto] = useState(0);
  const [linhasTabela, setLinhasTabela] = useState([]);

  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);

    // Pré-selecionar empresas (usuário pode alterar) - mesmas do Consolidado
    setEmpresasSelecionadas([
      { cd_empresa: '1' }, { cd_empresa: '2' }, { cd_empresa: '200' }, { cd_empresa: '75' },
      { cd_empresa: '31' }, { cd_empresa: '6' }, { cd_empresa: '85' }, { cd_empresa: '11' },
      { cd_empresa: '99' }, { cd_empresa: '92' }, { cd_empresa: '5' }, { cd_empresa: '500' },
      { cd_empresa: '55' }, { cd_empresa: '550' }, { cd_empresa: '65' }, { cd_empresa: '650' },
      { cd_empresa: '93' }, { cd_empresa: '930' }, { cd_empresa: '94' }, { cd_empresa: '940' },
      { cd_empresa: '95' }, { cd_empresa: '950' }, { cd_empresa: '96' }, { cd_empresa: '960' },
      { cd_empresa: '97' }, { cd_empresa: '970' }, { cd_empresa: '90' }, { cd_empresa: '91' },
      { cd_empresa: '890' }, { cd_empresa: '910' }, { cd_empresa: '920' }
    ]);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#000638] font-barlow">Receita Líquida</h1>

      <div className="mb-8">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setErro('');
          if (!empresasSelecionadas.length || !dataInicio || !dataFim) return;
          try {
            setLoading(true);
            const empresas = empresasSelecionadas.map(e => e.cd_empresa || e);
            const [rFat, rRev, rFrq, rMtm] = await Promise.all([
              apiClient.sales.receitaliquidaFaturamento({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresas }),
              apiClient.sales.receitaliquidaRevenda({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresas }),
              apiClient.sales.receitaliquidaFranquias({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresas }),
              apiClient.sales.receitaliquidaMtm({ dt_inicio: dataInicio, dt_fim: dataFim, cd_empresa: empresas })
            ]);

            // Unificar dados e aplicar mesmas regras de soma do Consolidado
            const all = [
              ...(Array.isArray(rFat.data) ? rFat.data : []),
              ...(Array.isArray(rRev.data) ? rRev.data : []),
              ...(Array.isArray(rFrq.data) ? rFrq.data : []),
              ...(Array.isArray(rMtm.data) ? rMtm.data : [])
            ];

            // Para revenda: priorizar class 3 removendo class 1 quando houver 3 para a mesma pessoa (como no Consolidado)
            const applyRevendaRule = (arr) => {
              const dados = Array.isArray(arr) ? arr : [];
              const apenas13 = dados.filter(row => {
                const cls = String(row.cd_classificacao ?? '').trim();
                return cls === '1' || cls === '3' || cls === '2' || cls === '4' || cls === '';
              });
              return apenas13.filter((row, _idx, array) => {
                const currentPessoa = row.cd_pessoa;
                const currentClass = String(row.cd_classificacao ?? '').trim();
                if (currentClass === '3') return true;
                if (currentClass === '1') {
                  const hasClass3 = array.some(item => item.cd_pessoa === currentPessoa && String(item.cd_classificacao ?? '').trim() === '3');
                  return !hasClass3;
                }
                return true;
              });
            };

            // Soma S - E por campo
            const sumField = (arr, field) => (arr || []).reduce((acc, r) => {
              const q = Number(r.qt_faturado) || 1;
              const value = (Number(r[field]) || 0) * q;
              if (r.tp_operacao === 'S') return acc + value;
              if (r.tp_operacao === 'E') return acc - value;
              return acc;
            }, 0);

            // Aplica regra de revenda apenas nos itens que têm classificações 1/3
            const allAdjusted = applyRevendaRule(all);
            const bruto = sumField(allAdjusted, 'vl_unitbruto');
            const liquido = sumField(allAdjusted, 'vl_unitliquido');
            const icms = sumField(allAdjusted, 'vl_icms');
            const desconto = bruto - liquido;

            setTotalBruto(bruto);
            setTotalLiquido(liquido);
            setTotalIcms(icms);
            setTotalDesconto(desconto);

            // Tabela por canal (Faturamento geral, Franquias, MTM, Revenda)
            const mkRow = (canal, arr, applyRevenda = false) => {
              const base = applyRevenda ? applyRevendaRule(arr) : arr;
              const b = sumField(base, 'vl_unitbruto');
              const l = sumField(base, 'vl_unitliquido');
              const i = sumField(base, 'vl_icms');
              const d = b - l;
              const pis = l * 0.0065;
              const cofins = l * 0.03;
              const rl = b - d - i - pis - cofins; // conforme solicitado
              return { canal, bruto: b, desconto: d, icms: i, pis, cofins, receitaLiquida: rl };
            };

            const rows = [
              mkRow('Faturamento', Array.isArray(rFat.data) ? rFat.data : []),
              mkRow('Franquia', Array.isArray(rFrq.data) ? rFrq.data : []),
              mkRow('Multimarca', Array.isArray(rMtm.data) ? rMtm.data : []),
              mkRow('Revenda', Array.isArray(rRev.data) ? rRev.data : [], true)
            ];
            setLinhasTabela(rows);
          } catch (err) {
            setErro('Falha ao carregar receita líquida.');
          } finally {
            setLoading(false);
          }
        }} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
                apenasEmpresa101={false}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-center">
              <button
                type="submit"
                disabled={loading || !dataInicio || !dataFim || !empresasSelecionadas.length}
                className="flex items-center gap-2 bg-[#000638] text-white px-6 py-3 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-10 text-sm font-bold shadow-md tracking-wide uppercase"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Cards Totais (Bruto, Líquido, ICMS, Desconto) */}
      {(totalBruto || totalLiquido || totalIcms || totalDesconto) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">Faturamento Bruto</div>
            <div className="text-lg font-extrabold text-purple-700">{totalBruto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">Faturamento Líquido</div>
            <div className="text-lg font-extrabold text-green-700">{totalLiquido.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">ICMS Total</div>
            <div className="text-lg font-extrabold text-teal-700">{totalIcms.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">Desconto Total</div>
            <div className="text-lg font-extrabold text-orange-700">{totalDesconto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">PIS (0,65%)</div>
            <div className="text-lg font-extrabold text-blue-700">{(totalLiquido * 0.0065).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div className="shadow rounded-lg bg-white p-3 border border-[#000638]/10">
            <div className="text-[11px] text-gray-500">COFINS (3,0%)</div>
            <div className="text-lg font-extrabold text-pink-700">{(totalLiquido * 0.03).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
        </div>
      )}
      {erro && (
        <div className="mt-4 text-sm text-red-600">{erro}</div>
      )}

      {/* Tabela por canal (modelo semelhante às tabelas do app) */}
      {linhasTabela.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full bg-white border border-[#000638]/10 rounded-lg overflow-hidden">
            <thead className="bg-[#f8f9fb]">
              <tr className="text-left text-xs font-semibold text-[#000638]">
                <th className="px-4 py-3 border-b">Canal</th>
                <th className="px-4 py-3 border-b">Faturamento Bruto</th>
                <th className="px-4 py-3 border-b">Desconto</th>
                <th className="px-4 py-3 border-b">ICMS</th>
                <th className="px-4 py-3 border-b">PIS</th>
                <th className="px-4 py-3 border-b">COFINS</th>
                <th className="px-4 py-3 border-b">Receita Líquida</th>
              </tr>
            </thead>
            <tbody>
              {linhasTabela.map((row, idx) => (
                <tr key={idx} className="text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">{row.canal}</td>
                  <td className="px-4 py-2 border-b">{row.bruto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.desconto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.icms.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.pis.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b">{row.cofins.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td className="px-4 py-2 border-b font-semibold text-[#000638]">{row.receitaLiquida.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReceitaLiquida;


