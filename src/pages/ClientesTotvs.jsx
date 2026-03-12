import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../config/constants';

const BATCH_SIZE = 500;
const MAX_CONSECUTIVE_EMPTY = 10;
const MAX_CODE = 100000;

export default function ClientesTotvs() {
  const [processando, setProcessando] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [totalEnviados, setTotalEnviados] = useState(0);
  const [totalPF, setTotalPF] = useState(0);
  const [totalPJ, setTotalPJ] = useState(0);
  const [status, setStatus] = useState(null);
  const [personCode, setPersonCode] = useState('');
  const [codigoInicial, setCodigoInicial] = useState('1');
  const [ultimoLote, setUltimoLote] = useState([]);
  const cancelRef = useRef(false);

  const saveBatch = async (clientes) => {
    const resp = await fetch(
      `${API_BASE_URL}/api/totvs/clientes/save-supabase`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientes }),
      },
    );
    return resp.json();
  };

  // Processo principal: busca em lotes de 500 códigos e salva cada um
  const handleBuscarTodos = async () => {
    setProcessando(true);
    setLotes([]);
    setUltimoLote([]);
    setTotalEnviados(0);
    setTotalPF(0);
    setTotalPJ(0);
    setStatus(null);
    cancelRef.current = false;

    let startCode = Math.max(1, parseInt(codigoInicial, 10) || 1);
    let loteNum = 0;
    let consecutiveEmpty = 0;
    let totalSent = 0;
    let pfCount = 0;
    let pjCount = 0;
    const allLotes = [];

    while (startCode <= MAX_CODE && consecutiveEmpty < MAX_CONSECUTIVE_EMPTY) {
      if (cancelRef.current) {
        setStatus({
          type: 'warning',
          msg: `Cancelado. ${totalSent} clientes enviados em ${allLotes.filter((l) => l.count > 0).length} lotes.`,
        });
        break;
      }

      const endCode = startCode + BATCH_SIZE - 1;
      loteNum++;

      setStatus({
        type: 'info',
        msg: `Buscando lote ${loteNum} (códigos ${startCode} a ${endCode})...`,
      });

      try {
        const resp = await fetch(
          `${API_BASE_URL}/api/totvs/clientes/fetch-batch?startCode=${startCode}&endCode=${endCode}`,
        );
        const json = await resp.json();

        if (json.success && json.data?.clientes?.length > 0) {
          const clientes = json.data.clientes;
          consecutiveEmpty = 0;

          setStatus({
            type: 'info',
            msg: `Salvando lote ${loteNum} (${clientes.length} clientes)...`,
          });

          const saveJson = await saveBatch(clientes);

          totalSent += clientes.length;
          pfCount += json.data.totalPF || 0;
          pjCount += json.data.totalPJ || 0;

          const lote = {
            num: loteNum,
            startCode,
            endCode,
            count: clientes.length,
            pfCount: json.data.totalPF || 0,
            pjCount: json.data.totalPJ || 0,
            saved: saveJson.success
              ? saveJson.data?.inserted || clientes.length
              : 0,
            errors: saveJson.data?.errors || 0,
            status: saveJson.success ? 'enviado' : 'erro',
            duration: json.data.duration,
          };
          allLotes.push(lote);
          setLotes([...allLotes]);
          setUltimoLote(clientes);
          setTotalEnviados(totalSent);
          setTotalPF(pfCount);
          setTotalPJ(pjCount);
        } else {
          consecutiveEmpty++;
          allLotes.push({
            num: loteNum,
            startCode,
            endCode,
            count: 0,
            status: 'vazio',
          });
          setLotes([...allLotes]);
        }
      } catch (err) {
        allLotes.push({
          num: loteNum,
          startCode,
          endCode,
          count: 0,
          status: 'erro',
          error: err.message,
        });
        setLotes([...allLotes]);
      }

      startCode = endCode + 1;
    }

    if (!cancelRef.current) {
      setStatus({
        type: 'success',
        msg: `Finalizado! ${totalSent} clientes (PF: ${pfCount} | PJ: ${pjCount}) enviados ao Supabase em ${allLotes.filter((l) => l.count > 0).length} lotes.`,
      });
    }
    setProcessando(false);
  };

  // Busca individual por código específico
  const handleBuscarCodigo = async () => {
    if (!personCode.trim()) return;
    setProcessando(true);
    setLotes([]);
    setUltimoLote([]);
    setTotalEnviados(0);
    setTotalPF(0);
    setTotalPJ(0);
    setStatus(null);

    try {
      const params = new URLSearchParams();
      params.append('personCode', personCode.trim());

      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/clientes/fetch-all?${params.toString()}`,
      );
      const json = await resp.json();

      if (json.success && json.data?.clientes?.length > 0) {
        const clientes = json.data.clientes;
        setUltimoLote(clientes);

        const saveJson = await saveBatch(clientes);
        setTotalEnviados(clientes.length);
        setTotalPF(json.data.totalPF || 0);
        setTotalPJ(json.data.totalPJ || 0);

        setLotes([
          {
            num: 1,
            startCode: personCode,
            endCode: personCode,
            count: clientes.length,
            pfCount: json.data.totalPF || 0,
            pjCount: json.data.totalPJ || 0,
            saved: saveJson.success
              ? saveJson.data?.inserted || clientes.length
              : 0,
            errors: saveJson.data?.errors || 0,
            status: saveJson.success ? 'enviado' : 'erro',
            duration: json.data.duration || json.data.fetchDuration,
          },
        ]);
        setStatus({
          type: 'success',
          msg: `${clientes.length} clientes encontrados e salvos no Supabase`,
        });
      } else {
        setStatus({
          type: 'error',
          msg: `Nenhum cliente encontrado com código ${personCode}`,
        });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: `Erro: ${err.message}` });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clientes TOTVS</h1>
        <p className="text-sm text-gray-500 mt-1">
          Busca automática em lotes de {BATCH_SIZE} códigos — cada lote é salvo
          automaticamente no Supabase
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Código inicial
          </label>
          <input
            type="number"
            min="1"
            value={codigoInicial}
            onChange={(e) => setCodigoInicial(e.target.value)}
            disabled={processando}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-28 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Ou código específico
          </label>
          <input
            type="text"
            value={personCode}
            onChange={(e) => setPersonCode(e.target.value)}
            placeholder="Ex: 180 ou 180,200"
            disabled={processando}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48 disabled:opacity-50"
          />
        </div>

        {personCode.trim() ? (
          <button
            onClick={handleBuscarCodigo}
            disabled={processando}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all ${
              processando
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            BUSCAR CÓDIGO
          </button>
        ) : (
          <button
            onClick={handleBuscarTodos}
            disabled={processando}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all ${
              processando
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {processando ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processando lotes...
              </span>
            ) : (
              'BUSCAR CLIENTES'
            )}
          </button>
        )}

        {processando && (
          <button
            onClick={() => {
              cancelRef.current = true;
            }}
            className="px-5 py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all"
          >
            CANCELAR
          </button>
        )}
      </div>

      {/* Status */}
      {status && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm font-medium ${
            status.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : status.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : status.type === 'warning'
                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Resumo */}
      {totalEnviados > 0 && (
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 min-w-[200px]">
            <p className="text-xs font-semibold text-green-600 uppercase">
              Total Enviados ao Supabase
            </p>
            <p className="text-2xl font-bold text-green-800 mt-1">
              {totalEnviados}
            </p>
            <p className="text-xs text-green-600 mt-1">
              PF: {totalPF} | PJ: {totalPJ} |{' '}
              {lotes.filter((l) => l.count > 0).length} lotes
            </p>
          </div>
        </div>
      )}

      {/* Log de lotes — estilo terminal */}
      {lotes.length > 0 && (
        <div className="mb-6 bg-gray-900 rounded-lg p-4 max-h-[350px] overflow-y-auto font-mono text-xs leading-relaxed">
          <p className="text-gray-500 mb-2">--- Log de envio em lotes ---</p>
          {lotes.map((lote) => (
            <div
              key={lote.num}
              className={`py-0.5 ${
                lote.status === 'enviado'
                  ? 'text-green-400'
                  : lote.status === 'vazio'
                    ? 'text-gray-600'
                    : 'text-red-400'
              }`}
            >
              {lote.status === 'enviado' &&
                `✅ Lote ${lote.num} de ${lote.count} CLIENTES enviado (códigos ${lote.startCode}-${lote.endCode} | PF:${lote.pfCount} PJ:${lote.pjCount} | ${lote.duration})`}
              {lote.status === 'vazio' &&
                `⏭️ Lote ${lote.num} vazio (códigos ${lote.startCode}-${lote.endCode})`}
              {lote.status === 'erro' &&
                `❌ Lote ${lote.num} erro (códigos ${lote.startCode}-${lote.endCode}): ${lote.error || 'Falha ao salvar'}`}
            </div>
          ))}
          {processando && (
            <div className="text-blue-400 animate-pulse mt-1">
              ⏳ Processando próximo lote...
            </div>
          )}
        </div>
      )}

      {/* Tabela do último lote */}
      {ultimoLote.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">
              Último lote carregado: {ultimoLote.length} clientes
            </p>
          </div>
          <div className="overflow-auto max-h-[40vh]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Código
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Tipo
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Empresa
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Nome
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    CPF/CNPJ
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Telefone
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    UF
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Cliente
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ultimoLote.map((c, idx) => (
                  <tr
                    key={`${c.cd_empresacad}-${c.code}-${idx}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 text-gray-800 font-mono">
                      {c.code}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          c.tipo_pessoa === 'PJ'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {c.tipo_pessoa || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {c.cd_empresacad}
                    </td>
                    <td className="px-3 py-2 text-gray-800 max-w-[250px] truncate">
                      {c.nm_pessoa || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {c.cpf || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {c.telefone || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs max-w-[200px] truncate">
                      {c.email || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {c.uf || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {c.is_customer ? (
                        <span className="text-green-600 text-xs font-semibold">
                          Sim
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Não</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-semibold ${
                          c.customer_status === 'Ativo' ||
                          c.person_status === 'Active'
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}
                      >
                        {c.customer_status || c.person_status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!processando &&
        lotes.length === 0 &&
        ultimoLote.length === 0 &&
        !status && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">
              Clique em "BUSCAR CLIENTES" para buscar em lotes de {BATCH_SIZE} e
              enviar ao Supabase
            </p>
            <p className="text-sm mt-2">
              Códigos 1-{BATCH_SIZE}, {BATCH_SIZE + 1}-{BATCH_SIZE * 2},{' '}
              {BATCH_SIZE * 2 + 1}-{BATCH_SIZE * 3}...
            </p>
          </div>
        )}
    </div>
  );
}
