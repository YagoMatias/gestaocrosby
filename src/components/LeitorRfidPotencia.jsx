// Regulador de POTÊNCIA do leitor RFID de mesa (Yago, 19/11/2026).
// Fica logo abaixo do botão de ligar o leitor, em todas as telas que usam o
// leitor (PDV Crosby, Transferência entre Lojas, Recebimento de Transferência,
// Configurações dos Aparelhos). Mesma ideia do regulador do portal
// (PortalPotenciaModal): potência maior lê mais longe e pega peça em volta do
// balcão; potência menor lê só o que está em cima do leitor.
// Quem conversa com o aparelho é o hook useRfidReader (`potencia`,
// `definirPotencia`, `lerPotencia`); a escolha fica guardada neste computador.
import React, { useEffect, useState } from 'react';
import { Lightning, Spinner, CheckCircle, Warning, ArrowsClockwise } from '@phosphor-icons/react';

// atalhos pensados para leitor de MESA (o portal usa valores mais altos)
const ATALHOS = [
  { label: 'Curto', valor: 5, dica: 'só a peça em cima do leitor' },
  { label: 'Médio', valor: 12, dica: 'pilha de peças no balcão' },
  { label: 'Longo', valor: 20, dica: 'sacola ou caixa' },
  { label: 'Máximo', valor: 30, dica: 'alcance total (lê em volta)' },
];

/**
 * @param {string} status      estado do leitor (hook): 'desconectado' | 'conectado' | 'reconectando'
 * @param {object|null} potencia  { valor, min, max, modelo } vindo do hook
 * @param {(dbm:number)=>Promise<number>} definirPotencia
 * @param {()=>Promise<number>} lerPotencia
 */
export default function LeitorRfidPotencia({ status, potencia, definirPotencia, lerPotencia, className = '' }) {
  const [valor, setValor] = useState(null); // o que o controle mostra enquanto arrasta
  const [gravando, setGravando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'erro', msg }

  // acompanha o que está gravado no aparelho
  useEffect(() => {
    setValor(potencia ? potencia.valor : null);
  }, [potencia]);
  useEffect(() => {
    if (status !== 'conectado') setAviso(null);
  }, [status]);

  if (status !== 'conectado') {
    return (
      <p className={`flex items-center gap-1.5 text-[11px] text-gray-400 ${className}`}>
        <Lightning size={12} /> Potência do leitor: ligue o leitor para regular.
      </p>
    );
  }

  const reler = async () => {
    setLendo(true);
    setAviso(null);
    try {
      await lerPotencia();
    } catch (e) {
      setAviso({ tipo: 'erro', msg: e.message });
    } finally {
      setLendo(false);
    }
  };

  if (!potencia) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-[11px] text-gray-500 ${className}`}>
        <span className="flex items-center gap-1.5">
          <Lightning size={12} /> {aviso?.tipo === 'erro' ? 'Este leitor não informou a potência.' : 'Lendo a potência do leitor…'}
        </span>
        <button type="button" onClick={reler} disabled={lendo} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
          {lendo ? <Spinner size={11} className="animate-spin" /> : <ArrowsClockwise size={11} />} tentar de novo
        </button>
      </div>
    );
  }

  const { min, max } = potencia;
  const mostrado = valor ?? potencia.valor;
  const limitar = (v) => Math.max(min, Math.min(max, Math.round(Number(v))));

  const gravar = async (v) => {
    const alvo = limitar(v);
    setValor(alvo);
    if (alvo === potencia.valor || gravando) return;
    setGravando(true);
    setAviso(null);
    try {
      const ficou = await definirPotencia(alvo);
      setAviso(ficou === alvo ? { tipo: 'ok', msg: `Potência gravada: ${ficou} dBm` } : { tipo: 'erro', msg: `O leitor ficou em ${ficou} dBm (não aceitou ${alvo}).` });
    } catch (e) {
      setValor(potencia.valor);
      setAviso({ tipo: 'erro', msg: `Não gravou: ${e.message}` });
    } finally {
      setGravando(false);
    }
  };

  return (
    <div className={`rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-gray-200 ${className}`}>
      <div className="flex items-center gap-2">
        <Lightning size={14} weight="fill" className="shrink-0 text-amber-500" />
        <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Potência do leitor</span>
        {gravando && <Spinner size={13} className="animate-spin text-gray-500" />}
        <span className="text-sm font-bold tabular-nums text-[#000638]">{mostrado} dBm</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={mostrado}
        disabled={gravando}
        aria-label="Potência do leitor RFID em dBm"
        onChange={(e) => setValor(limitar(e.target.value))}
        onMouseUp={(e) => gravar(e.currentTarget.value)}
        onTouchEnd={(e) => gravar(e.currentTarget.value)}
        onKeyUp={(e) => gravar(e.currentTarget.value)}
        className="mt-1.5 h-2 w-full cursor-pointer accent-[#000638] disabled:cursor-wait disabled:opacity-60"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {ATALHOS.filter((a) => a.valor >= min).map((a) => {
          const v = Math.min(a.valor, max);
          const on = potencia.valor === v;
          return (
            <button
              key={a.label}
              type="button"
              title={`${v} dBm — ${a.dica}`}
              disabled={gravando}
              onClick={() => gravar(v)}
              className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold ring-1 disabled:opacity-50 ${on ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'}`}
            >
              {a.label} {v}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-gray-500">Mais baixa: lê só o que está em cima do leitor. Mais alta: lê mais longe e pode pegar peça em volta.</p>
      {aviso && (
        <p className={`mt-1 flex items-start gap-1 text-[10.5px] font-semibold ${aviso.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {aviso.tipo === 'ok' ? <CheckCircle size={12} weight="fill" className="mt-px shrink-0" /> : <Warning size={12} weight="fill" className="mt-px shrink-0" />}
          {aviso.msg}
        </p>
      )}
    </div>
  );
}
