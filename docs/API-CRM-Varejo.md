# API Reference — Módulo CRM › Varejo

> Documento de handoff para configuração em outro sistema.
> Autossuficiente: contém base URL, autenticação, todos os endpoints, parâmetros,
> corpos de requisição (JSON) e contexto de banco de dados.
> Formato pensado para ser lido por um agente (LLM) e transcrito para qualquer cliente HTTP.

## 1. Configuração global

| Item | Valor |
|---|---|
| Base URL (produção) | `https://apigestaocrosby-bw2v.onrender.com` |
| Base URL (dev local) | `http://localhost:4100` |
| Autenticação padrão | Header `x-api-key: <API_KEY>` |
| Content-Type (POST/PATCH) | `application/json` |
| Cliente HTTP no frontend | `fetch` nativo |

**Variáveis (placeholders usados neste doc):**
- `{{base_url}}` → uma das Base URLs acima
- `{{api_key}}` → valor de `VITE_API_KEY` (definido no `.env` do frontend; **não versionar em texto plano**)
- `{{fila_branch}}` → código da loja (ex.: `2`, `55`, `95`)
- `{{fila_pin}}` → PIN da vendedora/loja (auth da Fila da Vez)

Datas sempre no formato `YYYY-MM-DD`. Mês no formato `YYYY-MM`.

---

## 2. CRM Varejo — endpoints específicos (`/api/crm/varejo/*`)

Todos exigem header `x-api-key: {{api_key}}`. Endpoints de escrita de competição exigem também
`x-user-role: admin` e `x-user-login: <login>`.

### 2.1 Avisos

```
GET {{base_url}}/api/crm/varejo/avisos?ativo=true&ano=2026&semana=27&limit=50
```
Lista avisos. Query params são opcionais.

```
POST {{base_url}}/api/crm/varejo/avisos
Content-Type: application/json
x-api-key: {{api_key}}

{
  "titulo": "Texto do título",
  "conteudo": "Corpo do aviso",
  "prioridade": "normal",
  "ano": 2026,
  "semana_iso": 27,
  "expira_em": null
}
```

```
PATCH {{base_url}}/api/crm/varejo/avisos/:id
```
Mesmo corpo do POST (campos a atualizar).

```
DELETE {{base_url}}/api/crm/varejo/avisos/:id
```
Remove o aviso (hard delete).

### 2.2 Competições

```
GET {{base_url}}/api/crm/varejo/competicoes?includeRanking=true
```
Lista competições. `?status=ativa` também suportado.

```
GET {{base_url}}/api/crm/varejo/competicoes/:id
```
Detalhe da competição com faturamento ao vivo.

```
POST {{base_url}}/api/crm/varejo/competicoes
Content-Type: application/json
x-api-key: {{api_key}}
x-user-role: admin
x-user-login: <login>

{
  "nome": "Nome da competição",
  "descricao": null,
  "premiacao": null,
  "data_inicio": "2026-07-01",
  "data_fim": "2026-07-31",
  "duracao_preset": "mensal",
  "branch_codes": [2, 55, 95],
  "meta_tipo": "faturamento",
  "meta_valor": 100000,
  "user_login": "<login>"
}
```

```
PATCH {{base_url}}/api/crm/varejo/competicoes/:id
x-user-role: admin
x-user-login: <login>

{ "acao": "encerrar", "user_login": "<login>" }
```
`acao` aceita: `encerrar`, `cancelar` (ou campos de edição).

```
DELETE {{base_url}}/api/crm/varejo/competicoes/:id
x-user-role: admin
x-user-login: <login>
```

### 2.3 Metas para reunião

```
POST {{base_url}}/api/crm/varejo/metas-reuniao
Content-Type: application/json
x-api-key: {{api_key}}

{ "mes": "2026-07" }
```
Retorna metas + faturamento do mês das 12 lojas varejo.

### 2.4 Crescimento

```
POST {{base_url}}/api/crm/varejo/crescimento
Content-Type: application/json
x-api-key: {{api_key}}

{ "datemin": "2026-07-01", "datemax": "2026-07-06" }
```
Compara faturamento das lojas varejo no período vs. mesmo período anterior.

---

## 3. CRM gerais usados pelo Varejo (`/api/crm/*`)

```
GET {{base_url}}/api/crm/conversao-resumo?canal=varejo&datemin=2026-07-01&datemax=2026-07-06
```
Resumo de conversão do canal varejo.

```
POST {{base_url}}/api/crm/sellers-totals?nocache=true
Content-Type: application/json
x-api-key: {{api_key}}

{
  "datemin": "2026-07-01",
  "datemax": "2026-07-06",
  "modulo": "varejo",
  "nocache": true
}
```
Desempenho por vendedora (mesma fonte da tela CRM › Performance).

---

## 4. Fila da Vez (`/api/fila/*`)

### 4.1 Admin / Dashboard (header `x-api-key`)

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/fila/lojas` | Lista lojas + config de fila |
| POST | `/api/fila/lojas` | Cria/atualiza config (PIN, ativo) |
| GET | `/api/fila/vendedoras` | Lista vendedoras por loja |
| POST | `/api/fila/vendedoras` | Cadastra vendedora |
| PATCH | `/api/fila/vendedoras/:id` | Atualiza vendedora |
| DELETE | `/api/fila/vendedoras/:id` | Remove/desativa vendedora |
| GET | `/api/fila/motivos` | Lista motivos de não-venda |
| POST | `/api/fila/motivos` | Cadastra motivo |
| PATCH | `/api/fila/motivos/:id` | Atualiza motivo |
| DELETE | `/api/fila/motivos/:id` | Desativa motivo |
| GET | `/api/fila/dashboard?branch={{fila_branch}}&datemin=&datemax=` | Métricas (conversão, ticket, tempo) |
| GET | `/api/fila/atendimentos` | Lista atendimentos com filtros |

### 4.2 Operação da vendedora (auth por PIN)

Headers desses endpoints: `x-fila-branch: {{fila_branch}}` e `x-fila-pin: {{fila_pin}}`.

| Método | Endpoint | Função |
|---|---|---|
| POST | `/api/fila/public/login` | Login da vendedora via PIN |
| GET | `/api/fila/public/estado` | Estado atual da fila |
| POST | `/api/fila/public/entrar-fila` | Entra na fila |
| POST | `/api/fila/public/iniciar-atendimento` | Inicia atendimento |
| POST | `/api/fila/public/finalizar-atendimento` | Finaliza (com dados de venda) |
| POST | `/api/fila/public/pausa` | Pausa/folga/atestado |
| POST | `/api/fila/public/sair` | Sai da fila |
| GET | `/api/fila/public/motivos` | Motivos ativos |
| POST | `/api/fila/public/lookup-cliente` | Valida cliente no TOTVS (CPF/CNPJ) |

---

## 5. Apoio (TOTVS)

```
GET {{base_url}}/api/totvs/branches
```
Lista de lojas/filiais (usado para popular selects de loja).

---

## 6. Banco de dados

- **SGBD:** PostgreSQL via **Supabase** (acesso pela API PostgREST, lib `@supabase/supabase-js`).
- **Config backend:** `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (variáveis de ambiente).
- **Banco fiscal secundário:** `SUPABASE_FISCAL_URL` + `SUPABASE_FISCAL_KEY` (notas fiscais).

**Tabelas do módulo varejo:**

| Tabela | Conteúdo |
|---|---|
| `crm_varejo_avisos` | Avisos |
| `crm_varejo_competicoes` | Competições |
| `fila_lojas_config` | Config por loja (PIN, ativo) |
| `fila_vendedoras` | Cadastro de vendedoras |
| `fila_motivos_nao_venda` | Motivos de não-venda |
| `fila_vendedora_status` | Estado atual na fila |
| `fila_atendimentos` | Histórico de atendimentos/vendas |
| `fila_status_log` | Log de mudanças de status |
| `faturamento_diario_canal` | Faturamento diário por canal |
| `faturamento_transacao_historico` | Faturamento por NF |

---

## 7. Observações importantes

1. **Endpoint legado/morto:** `GET /api/faturamento/fat-varejo?dataInicio=&dataFim=` é chamado
   pelo frontend (`DashboardVarejo.jsx`) mas **não existe no backend atual** — não há handler nem
   mount para `/api/faturamento`. NÃO configurar como válido. Para faturamento do varejo use
   `POST /api/crm/varejo/metas-reuniao` ou `POST /api/crm/sellers-totals` (com `modulo: "varejo"`).

2. **Segurança:** a `SUPABASE_SERVICE_KEY` dá acesso total ao banco (ignora RLS). Nunca expor no
   cliente nem versionar em texto plano. O `x-api-key` do frontend também deve vir de variável de ambiente.

3. **Lojas varejo (branch codes)** referenciadas pelo módulo: 2 (João Pessoa), 5 (Nova Cruz),
   55 (Parnamirim), 65 (Canguaretama), 87 (Cidade Jardim), 88 (Guararapes), 90 (Ayrton Senna),
   93 (Imperatriz), 94 (Patos), 95 (Midway), 97 (Teresina), 98 (Shopping Recife).
