// Página: Financeiro → Conciliação → Conciliação
// Cadastro das contas bancárias do grupo (planilha CONTAS BANCARIAS, 10/2026),
// agrupadas por empresa. Por enquanto só a lista; o batimento virá depois.
import React, { useMemo, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { Bank, MagnifyingGlass } from '@phosphor-icons/react';

// CTA = código da conta no TOTVS · CODIGO = código do banco (FEBRABAN)
const CONTAS = [
  // FERREIRA COMERCIO E CONFECCOES LTDA
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10001, cnpj: '17.177.680/0001-16', banco: 'ITAU', codigo: 341, ag: '6530', conta: '27061-7' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10002, cnpj: '17.177.680/0001-16', banco: 'SANTANDER', codigo: 33, ag: '1575', conta: '13000599-5' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10003, cnpj: '17.177.680/0001-16', banco: 'SANTANDER VINCULADA', codigo: 33, ag: '1575', conta: '29000199-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10004, cnpj: '17.177.680/0001-16', banco: 'CAIXA', codigo: 104, ag: '6370', conta: '578136386-2' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10005, cnpj: '17.177.680/0001-16', banco: 'BANCO DO BRASIL', codigo: 1, ag: '1533', conta: '58711-7' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10006, cnpj: '17.177.680/0001-16', banco: 'SICREDI', codigo: 748, ag: '2207', conta: '36733-8' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10007, cnpj: '17.177.680/0001-16', banco: 'BANCO DO NORDESTE 1', codigo: 4, ag: '35', conta: '069919-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10008, cnpj: '17.177.680/0001-16', banco: 'BANCO DO NORDESTE 2', codigo: 4, ag: '35', conta: '069918-1' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10009, cnpj: '17.177.680/0001-16', banco: 'UNICRED', codigo: 136, ag: '6012', conta: '6850-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10010, cnpj: '17.177.680/0001-16', banco: 'BRADESCO', codigo: 237, ag: '2821', conta: '249374-8' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10011, cnpj: '17.177.680/0002-05', banco: 'SANTANDER JOAO PESSOA', codigo: 33, ag: '1575', conta: '13001128-2' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10012, cnpj: '17.177.680/0009-73', banco: 'STONE TERESINA', codigo: 197, ag: '1', conta: '-' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 10018, cnpj: '17.177.680/0010-07', banco: 'STONE BREJINHO', codigo: 197, ag: '1', conta: '71938990-0' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 60001, cnpj: '17.177.680/0001-16', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47097134-2' },
  { empresa: 'FERREIRA COMERCIO E CONFECCOES LTDA', cta: 1015, cnpj: '17.177.680/0010-07', banco: 'PAGARME', codigo: '-', ag: '-', conta: '-' },
  // FA MODA & VAREJO LTDA
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20001, cnpj: '27.728.810/0001-15', banco: 'ITAU', codigo: 341, ag: '6530', conta: '33688-9' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20002, cnpj: '27.728.810/0001-15', banco: 'ITAU VINCULADA', codigo: 341, ag: '6530', conta: '56927-3' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20003, cnpj: '27.728.810/0001-15', banco: 'ITAU MIDWAY', codigo: 341, ag: '382', conta: '98141-3' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20007, cnpj: '27.728.810/0001-15', banco: 'SANTANDER', codigo: 33, ag: '4543', conta: '13006882-4' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20008, cnpj: '27.728.810/0001-15', banco: 'CAIXA', codigo: 104, ag: '6370', conta: '578136459-1' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20009, cnpj: '27.728.810/0001-15', banco: 'BANCO DO BRASIL', codigo: 1, ag: '221', conta: '36960-8' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20010, cnpj: '27.728.810/0001-15', banco: 'SICREDI', codigo: 748, ag: '2207', conta: '32693-3' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20011, cnpj: '27.728.810/0001-15', banco: 'BANCO DO NORDESTE 1', codigo: 4, ag: '35', conta: '069922-0' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20012, cnpj: '27.728.810/0001-15', banco: 'BANCO DO NORDESTE 2', codigo: 44, ag: '35', conta: '069921-1' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20013, cnpj: '27.728.810/0001-15', banco: 'UNICRED', codigo: 136, ag: '6012', conta: '249374-8' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20014, cnpj: '27.728.810/0001-15', banco: 'BRADESCO', codigo: 237, ag: '2821', conta: '249286-5' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20020, cnpj: '27.728.810/0009-72', banco: 'STONE CIDADE JARDIM', codigo: 197, ag: '1', conta: '38055887-4' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20021, cnpj: '27.728.810/0006-20', banco: 'STONE CANGUARETAMA', codigo: 197, ag: '1', conta: '44463972-8' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20022, cnpj: '27.728.810/0005-49', banco: 'STONE MIDWAY', codigo: 197, ag: '1', conta: '43413690-9' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 20023, cnpj: '27.728.810/0010-06', banco: 'STONE GUARARAPES', codigo: 197, ag: '1', conta: '35482671-1' },
  { empresa: 'FA MODA & VAREJO LTDA', cta: 60002, cnpj: '27.728.810/0001-15', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47097409-8' },
  // AZ VESTUARIO LTDA
  { empresa: 'AZ VESTUARIO LTDA', cta: 30001, cnpj: '33.592.092/0001-03', banco: 'ITAU', codigo: 341, ag: '6530', conta: '39046-4' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30002, cnpj: '33.592.092/0001-03', banco: 'SICREDI', codigo: 748, ag: '2207', conta: '36734-6' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30003, cnpj: '33.592.092/0001-03', banco: 'BANCO DO NORDESTE 1', codigo: 4, ag: '35', conta: '069361-2' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30004, cnpj: '33.592.092/0001-03', banco: 'BANCO DO NORDESTE 2', codigo: 4, ag: '35', conta: '069363-9' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30005, cnpj: '33.592.092/0001-03', banco: 'BANCO DO BRASIL', codigo: 1, ag: '221', conta: '370151-7' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30007, cnpj: '33.592.092/0001-03', banco: 'CAIXA', codigo: 104, ag: '6370', conta: '578136635-7' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30008, cnpj: '33.592.092/0001-03', banco: 'BRADESCO', codigo: 237, ag: '2821', conta: '52642-8' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 30010, cnpj: '33.592.092/0001-03', banco: 'STONE IRMAOS CR', codigo: 197, ag: '1', conta: '21774800-3' },
  { empresa: 'AZ VESTUARIO LTDA', cta: 60003, cnpj: '33.592.092/0001-03', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47123827-9' },
  // IRMAOS VAREJO COMERCIAL LTDA
  { empresa: 'IRMAOS VAREJO COMERCIAL LTDA', cta: 40001, cnpj: '53.661.116/0001-38', banco: 'ITAU', codigo: 341, ag: '6530', conta: '98073-6' },
  { empresa: 'IRMAOS VAREJO COMERCIAL LTDA', cta: 40002, cnpj: '53.661.116/0001-38', banco: 'STONE IRMAOS VAREJO', codigo: 197, ag: '1', conta: '97340355-3' },
  { empresa: 'IRMAOS VAREJO COMERCIAL LTDA', cta: 60004, cnpj: '53.661.116/0001-38', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47122948-4' },
  // SERVICOS INTEGRADOS
  { empresa: 'SERVICOS INTEGRADOS', cta: 60005, cnpj: '61.469.380/0001-00', banco: 'MENTORE A01', codigo: '-', ag: '1', conta: '47097549-1' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60006, cnpj: '61.469.224/0001-31', banco: 'MENTORE A02', codigo: '-', ag: '1', conta: '47065279-3' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60007, cnpj: '61.469.160/0001-79', banco: 'MENTORE A03', codigo: '-', ag: '1', conta: '47107666-1' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60008, cnpj: '61.480.564/0001-63', banco: 'MENTORE A04', codigo: '-', ag: '1', conta: '47097284-5' },
  { empresa: 'SERVICOS INTEGRADOS', cta: 60009, cnpj: '61.504.881/0001-72', banco: 'MENTORE A05', codigo: '-', ag: '-', conta: '-' },
  // CROSBY RECIFE MALL LTDA
  { empresa: 'CROSBY RECIFE MALL LTDA', cta: 957, cnpj: '36.569.459/0001-58', banco: 'ITAU', codigo: 341, ag: '1339', conta: '98391-6' },
  { empresa: 'CROSBY RECIFE MALL LTDA', cta: 7002, cnpj: '36.569.459/0001-58', banco: 'MENTORE', codigo: '-', ag: '1', conta: '47038112-0' },
  { empresa: 'CROSBY RECIFE MALL LTDA', cta: 7004, cnpj: '36.569.459/0001-58', banco: 'STONE', codigo: 197, ag: '1', conta: '49156344-1' },
];

const EMPRESAS = [...new Set(CONTAS.map((c) => c.empresa))];

const Conciliacao = () => {
  const [busca, setBusca] = useState('');
  const [empresaFiltro, setEmpresaFiltro] = useState('todas');

  const contas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return CONTAS.filter((c) => {
      if (empresaFiltro !== 'todas' && c.empresa !== empresaFiltro) return false;
      if (q && !`${c.cta} ${c.cnpj} ${c.banco} ${c.codigo} ${c.ag} ${c.conta}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [busca, empresaFiltro]);

  const grupos = useMemo(
    () => EMPRESAS.map((e) => ({ empresa: e, contas: contas.filter((c) => c.empresa === e) })).filter((g) => g.contas.length),
    [contas],
  );

  const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap';
  const td = 'px-3 py-2 text-xs whitespace-nowrap';

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title="Conciliação" subtitle="Contas bancárias do grupo cadastradas para conciliação" icon={Bank} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 mb-4 flex flex-col gap-2.5 md:flex-row md:items-end md:gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
          <select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="todas">Todas as empresas ({CONTAS.length} contas)</option>
            {EMPRESAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="md:w-72">
          <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="CTA, CNPJ, banco, agência, conta…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className={th}>CTA</th>
                <th className={th}>CNPJ</th>
                <th className={th}>Banco</th>
                <th className={`${th} text-right`}>Código</th>
                <th className={`${th} text-right`}>Agência</th>
                <th className={`${th} text-right`}>Conta</th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              ) : (
                grupos.map((g) => (
                  <React.Fragment key={g.empresa}>
                    <tr className="bg-blue-50 border-b border-blue-100">
                      <td colSpan={6} className="px-3 py-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
                        {g.empresa} <span className="font-normal text-blue-700">· {g.contas.length} conta(s)</span>
                      </td>
                    </tr>
                    {g.contas.map((c) => (
                      <tr key={`${g.empresa}-${c.cta}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className={`${td} font-mono font-medium text-gray-800`}>{c.cta}</td>
                        <td className={`${td} font-mono text-gray-600`}>{c.cnpj}</td>
                        <td className={`${td} text-gray-800`}>{c.banco}</td>
                        <td className={`${td} text-right font-mono text-gray-600`}>{c.codigo}</td>
                        <td className={`${td} text-right font-mono text-gray-600`}>{c.ag}</td>
                        <td className={`${td} text-right font-mono text-gray-800`}>{c.conta}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          {contas.length} conta(s) · {grupos.length} empresa(s)
        </div>
      </div>
    </div>
  );
};

export default Conciliacao;
