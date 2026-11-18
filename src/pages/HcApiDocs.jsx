// ============================================================================
// HEADCOACH › API HEADCOACH — documentação (Yago, 18/11/2026)
// Mostra, dentro do HeadCoach, a documentação da API de consulta que o Dryland
// usa: /api/headcoach/<módulo>/v1/<recurso> (somente GET, padrão TOTVS).
// Nada aqui é escrito à mão: a página lê /api/headcoach/openapi.json, que a API
// gera das mesmas declarações que criam as rotas (apigestaocrosby/routes/headcoachApi).
// Rota nova na API aparece aqui sozinha.
// A chave de acesso NÃO aparece nesta página (fica só no servidor: HEADCOACH_API_KEYS).
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { BracketsCurly, CaretDown, CaretRight, Copy, Check, MagnifyingGlass, ArrowSquareOut, Warning, Spinner } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

const BASE = '/api/headcoach';
const nomeDoRef = (ref) => String(ref || '').split('/').pop();

// "integer", "string (date)", "TransactionItem[]", "object"…
function tipoDe(p) {
  if (!p) return '';
  if (p.$ref) return nomeDoRef(p.$ref);
  if (p.type === 'array') return `${p.items?.$ref ? nomeDoRef(p.items.$ref) : p.items?.type || 'object'}[]`;
  if (p.format) return `${p.type} (${p.format})`;
  return p.type || 'object';
}
// esquema filho de um campo (para abrir os campos de dentro), quando houver
function filhoDe(p, schemas) {
  if (!p) return null;
  const alvo = p.type === 'array' ? p.items : p;
  if (alvo?.$ref) return schemas[nomeDoRef(alvo.$ref)] || null;
  if (alvo?.properties) return alvo;
  return null;
}
// separa a resposta 200 em { lista, esquema, nome }
function respostaDe(op, schemas) {
  const sc = op?.responses?.['200']?.content?.['application/json']?.schema;
  if (!sc) return null;
  if (sc.$ref) return { lista: false, nome: nomeDoRef(sc.$ref), esquema: schemas[nomeDoRef(sc.$ref)] };
  const item = sc.properties?.items?.items;
  if (item?.$ref) return { lista: true, nome: nomeDoRef(item.$ref), esquema: schemas[nomeDoRef(item.$ref)] };
  return { lista: false, nome: '', esquema: sc };
}

function Copiar({ texto, rotulo = 'Copiar' }) {
  const [ok, setOk] = useState(false);
  const copiar = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(texto);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
  };
  return (
    <button type="button" onClick={copiar} className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
      {ok ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {ok ? 'Copiado' : rotulo}
    </button>
  );
}

// texto com `código` entre crases (como vem nas descrições da API)
function Texto({ children }) {
  const partes = String(children || '').split(/(`[^`]+`)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded bg-indigo-50 px-1 py-0.5 text-[0.85em] text-indigo-800">
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

function Campos({ esquema, schemas, nivel = 0 }) {
  const [abertos, setAbertos] = useState({});
  const props = Object.entries(esquema?.properties || {});
  if (!props.length) return <p className="text-xs text-gray-500">Objeto livre (as chaves variam conforme o registro).</p>;
  return (
    <div className={nivel ? 'ml-3 border-l-2 border-indigo-100 pl-3' : ''}>
      {props.map(([nome, p]) => {
        const filho = filhoDe(p, schemas);
        const aberto = !!abertos[nome];
        return (
          <div key={nome} className="border-b border-gray-100 py-1.5 last:border-b-0">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <div className="flex shrink-0 items-baseline gap-2 sm:w-72">
                {filho ? (
                  <button type="button" onClick={() => setAbertos((a) => ({ ...a, [nome]: !a[nome] }))} className="inline-flex items-center gap-1 font-mono text-[13px] font-semibold text-[#000638] hover:text-indigo-700">
                    {aberto ? <CaretDown size={11} /> : <CaretRight size={11} />}
                    {nome}
                  </button>
                ) : (
                  <span className="font-mono text-[13px] font-semibold text-[#000638]">{nome}</span>
                )}
                <span className="font-mono text-[11px] text-gray-500">{tipoDe(p)}</span>
              </div>
              <div className="min-w-0 flex-1 text-[13px] text-gray-700">
                <Texto>{p.description || ''}</Texto>
                {p.enum && (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {p.enum.map((v) => (
                      <code key={v} className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">
                        {v}
                      </code>
                    ))}
                  </span>
                )}
                {p.example !== undefined && !p.enum && <span className="ml-1 text-[11px] text-gray-400">ex.: {String(p.example)}</span>}
              </div>
            </div>
            {filho && aberto && (
              <div className="mt-1.5">
                <Campos esquema={filho} schemas={schemas} nivel={nivel + 1} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Rota({ caminho, op, schemas, servidor }) {
  const [aberta, setAberta] = useState(false);
  const resposta = useMemo(() => respostaDe(op, schemas), [op, schemas]);
  const params = op.parameters || [];
  const naUrl = params.filter((p) => p.in === 'path');
  const filtros = params.filter((p) => p.in === 'query');
  const exemplo = `curl -H "X-API-Key: <chave>" "${servidor}${caminho}"`;
  return (
    <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
      <button type="button" onClick={() => setAberta((a) => !a)} className="flex w-full items-center gap-3 bg-sky-50/70 px-3 py-2 text-left hover:bg-sky-50">
        <span className="shrink-0 rounded bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-white">GET</span>
        <span className="min-w-0 flex-1">
          <span className="block break-all font-mono text-[13px] font-semibold text-[#000638]">{caminho}</span>
          <span className="block text-xs text-gray-600">{op.summary}</span>
        </span>
        {aberta ? <CaretDown size={14} className="shrink-0 text-gray-500" /> : <CaretRight size={14} className="shrink-0 text-gray-500" />}
      </button>
      {aberta && (
        <div className="space-y-4 px-3 py-3">
          {op.description && (
            <p className="text-[13px] leading-relaxed text-gray-700">
              <Texto>{op.description}</Texto>
            </p>
          )}
          <div className="flex items-center gap-2 rounded bg-gray-900 px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-gray-100">{exemplo}</code>
            <Copiar texto={exemplo} />
          </div>
          {naUrl.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Na URL</h4>
              <Campos esquema={{ properties: Object.fromEntries(naUrl.map((p) => [p.name, { ...p.schema, description: p.description }])) }} schemas={schemas} />
            </div>
          )}
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Filtros ({filtros.length})</h4>
            {filtros.length ? (
              <Campos esquema={{ properties: Object.fromEntries(filtros.map((p) => [p.name + (p.required ? ' *' : ''), { ...p.schema, description: p.description }])) }} schemas={schemas} />
            ) : (
              <p className="text-xs text-gray-500">Sem filtros.</p>
            )}
          </div>
          {resposta && (
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                Resposta{resposta.nome ? ` — ${resposta.nome}` : ''}
              </h4>
              {resposta.lista && (
                <p className="mb-1.5 text-xs text-gray-600">
                  Lista paginada: <code className="rounded bg-gray-100 px-1">{'{ items, count, totalItems, totalPages, hasNext, page, pageSize }'}</code>. Cada item de <code className="rounded bg-gray-100 px-1">items</code> tem os campos abaixo.
                </p>
              )}
              <Campos esquema={resposta.esquema} schemas={schemas} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HcApiDocs() {
  const [spec, setSpec] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState({});

  useEffect(() => {
    let vivo = true;
    fetch(`${API_BASE_URL}${BASE}/openapi.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!j?.paths) throw new Error('resposta sem rotas');
        if (vivo) setSpec(j);
      })
      .catch((e) => vivo && setErro(e.message || 'falha'));
    return () => {
      vivo = false;
    };
  }, []);

  // os botões abrem a documentação na MESMA API que esta página usa (API_BASE_URL);
  // os exemplos de chamada mostram o endereço de produção, que é o que o Dryland usa
  const servidor = /^https?:\/\//.test(spec?.servers?.[0]?.url || '') ? spec.servers[0].url : 'https://apigestaocrosby-bw2v.onrender.com';
  const schemas = spec?.components?.schemas || {};

  // módulos na ordem da API, cada um com as suas rotas (já filtradas pela busca)
  const modulos = useMemo(() => {
    if (!spec) return [];
    const termo = busca.trim().toLowerCase();
    return (spec.tags || [])
      .map((tag) => {
        const rotas = Object.entries(spec.paths)
          .filter(([, v]) => v.get?.tags?.includes(tag.name))
          .map(([caminho, v]) => ({ caminho, op: v.get }))
          .filter(({ caminho, op }) => {
            if (!termo) return true;
            const alvo = `${caminho} ${op.summary || ''} ${op.description || ''} ${(op.parameters || []).map((p) => p.name).join(' ')}`.toLowerCase();
            return alvo.includes(termo);
          });
        return { ...tag, rotas };
      })
      .filter((m) => m.rotas.length);
  }, [spec, busca]);
  const totalRotas = spec ? Object.keys(spec.paths).length : 0;
  const curl = `curl -H "X-API-Key: <chave>" "${servidor}${BASE}/transaction/v1/transactions?branchCodeList=95&startDate=2026-11-17&endDate=2026-11-17&expand=items,payments"`;
  const link = 'inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50';

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4">
      <PageTitle
        title="API HeadCoach"
        subtitle="Rotas de consulta dos dados do HeadCoach para outros sistemas (Dryland). Somente leitura, organizada como a API do TOTVS."
        icon={BracketsCurly}
        iconColor="text-indigo-600"
      />

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <a className={link} href={`${API_BASE_URL}${BASE}/docs`} target="_blank" rel="noreferrer">
            <ArrowSquareOut size={14} /> Abrir no Swagger (testar as rotas)
          </a>
          <a className={link} href={`${API_BASE_URL}${BASE}/openapi.json`} target="_blank" rel="noreferrer">
            <ArrowSquareOut size={14} /> OpenAPI (JSON)
          </a>
          <a className={link} href={`${API_BASE_URL}${BASE}/guide`} target="_blank" rel="noreferrer">
            <ArrowSquareOut size={14} /> Guia em texto (para programador ou IA)
          </a>
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-[13px] text-gray-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-[#000638]">Endereço</dt>
            <dd>
              <code className="break-all rounded bg-gray-100 px-1">{`${servidor}${BASE}/<módulo>/v1/<recurso>`}</code> — só <code className="rounded bg-gray-100 px-1">GET</code>.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#000638]">Acesso</dt>
            <dd>
              Chave no cabeçalho <code className="rounded bg-gray-100 px-1">X-API-Key</code> (ou <code className="rounded bg-gray-100 px-1">Authorization: Bearer</code>). A chave fica só no servidor e não aparece aqui.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#000638]">Paginação</dt>
            <dd>
              <code className="rounded bg-gray-100 px-1">page</code> (começa em 1) e <code className="rounded bg-gray-100 px-1">pageSize</code> (padrão 100, até 1000). Avance enquanto <code className="rounded bg-gray-100 px-1">hasNext</code> for <code className="rounded bg-gray-100 px-1">true</code>.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#000638]">Filtros</dt>
            <dd>
              Na URL; listas separadas por vírgula (<code className="rounded bg-gray-100 px-1">branchCodeList=95,99</code>), datas em <code className="rounded bg-gray-100 px-1">AAAA-MM-DD</code>. Filtro desconhecido devolve erro 400.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#000638]">Detalhes junto</dt>
            <dd>
              <code className="rounded bg-gray-100 px-1">expand=items,payments</code> traz as listas extras na mesma chamada.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#000638]">Sincronização</dt>
            <dd>
              Os recursos principais aceitam <code className="rounded bg-gray-100 px-1">startChangeDate</code> (alterados desde).
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center gap-2 rounded bg-gray-900 px-3 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-gray-100">{curl}</code>
          <Copiar texto={curl} />
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Warning size={18} className="mt-0.5 shrink-0" />
          <span>
            Não consegui ler a lista de rotas da API ({erro}). Os botões acima abrem a documentação direto no servidor.
          </span>
        </div>
      )}
      {!spec && !erro && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Spinner size={18} className="animate-spin" /> Carregando as rotas…
        </div>
      )}

      {spec && (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              <strong className="text-[#000638]">{spec.tags?.length || 0} módulos</strong> · <strong className="text-[#000638]">{totalRotas} rotas</strong>
              {busca.trim() ? ` · ${modulos.reduce((s, m) => s + m.rotas.length, 0)} na busca` : ''}
            </p>
            <label className="relative block w-full sm:w-80">
              <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar rota, assunto ou filtro…"
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="space-y-2">
            {modulos.map((m) => {
              const aberto = busca.trim() ? true : !!abertos[m.name];
              return (
                <section key={m.name} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <button type="button" onClick={() => setAbertos((a) => ({ ...a, [m.name]: !a[m.name] }))} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                    <span className="mt-0.5 shrink-0 text-gray-500">{aberto ? <CaretDown size={16} /> : <CaretRight size={16} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-base font-bold text-[#000638]">{m.name}</span>
                        <span className="text-xs text-gray-500">
                          {m.rotas.length} {m.rotas.length === 1 ? 'rota' : 'rotas'}
                        </span>
                      </span>
                      <span className="block text-[13px] text-gray-600">{m.description}</span>
                    </span>
                  </button>
                  {aberto && (
                    <div className="space-y-2 border-t border-gray-100 px-4 py-3">
                      {m.rotas.map(({ caminho, op }) => (
                        <Rota key={caminho} caminho={caminho} op={op} schemas={schemas} servidor={servidor} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {!modulos.length && <p className="py-8 text-center text-sm text-gray-500">Nenhuma rota com “{busca}”.</p>}
          </div>
        </>
      )}
    </div>
  );
}
