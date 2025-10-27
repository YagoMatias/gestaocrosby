import{r as s,j as t,s as B,E as H,b as V}from"./index-a2563983.js";import{c as d,D as R}from"./contas-75c47386.js";import{m as W}from"./ArrowsClockwise.es-cccb614c.js";import{s as $}from"./CaretUp.es-b369da07.js";import{c as G}from"./CaretUpDown.es-453a995a.js";import{p as A}from"./Spinner.es-3c850cda.js";import{C as Z,a as q,b as J,c as K}from"./cards-fd94db0b.js";import{u as Q}from"./useApiClient-0bf86fc1.js";const u=20,xe=()=>{const p=Q(),[c,b]=s.useState([]),[X,h]=s.useState(0),[m,g]=s.useState(!1),[v,w]=s.useState(""),[Y,z]=s.useState(!1),[F,y]=s.useState([]),[P,_]=s.useState(0),[ee,j]=s.useState(!1),[te,S]=s.useState("");s.useState(!0);const[l,N]=s.useState({nr_ctapes:[],dt_movim_ini:"",dt_movim_fim:""});s.useState(!0),s.useState(!1),s.useState({title:"",description:"",calculation:""});const[C,D]=s.useState(1),[ae,L]=s.useState(1),[i,I]=s.useState({campo:null,direcao:"asc"}),[se,E]=s.useState(new Set);s.useEffect(()=>{const e=document.createElement("style");return e.textContent=`
      .table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      .extrato-table {
        border-collapse: collapse;
        width: 100%;
      }
      .extrato-table th,
      .extrato-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }
      .extrato-table th:last-child,
      .extrato-table td:last-child {
        border-right: none;
      }
      .extrato-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      .extrato-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      .extrato-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      .extrato-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      /* CSS para coluna fixa */
      .extrato-table thead th:first-child,
      .extrato-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      .extrato-table thead th:first-child {
        background: #000638 !important;
        z-index: 20 !important;
        border-right: 2px solid #374151 !important;
      }
      .extrato-table tbody tr:nth-child(even) td:first-child {
        background: #fafafa !important;
      }
      .extrato-table tbody tr:nth-child(odd) td:first-child {
        background: #ffffff !important;
      }
      .extrato-table tbody tr:hover td:first-child {
        background: #f0f9ff !important;
      }
      .extrato-table tbody tr.bg-blue-100 td:first-child {
        background: #dbeafe !important;
      }
      .extrato-table tbody tr.bg-blue-100:hover td:first-child {
        background: #bfdbfe !important;
      }
      .extrato-table th:first-child input[type="checkbox"] {
        transform: scale(1.1);
      }
      .extrato-table td:first-child input[type="checkbox"] {
        transform: scale(1.1);
      }
    `,document.head.appendChild(e),()=>{document.head.removeChild(e)}},[]),s.useCallback(e=>{I(o=>({campo:e,direcao:o.campo===e&&o.direcao==="asc"?"desc":"asc"}))},[]),s.useCallback(e=>i.campo!==e?t.jsx(G,{size:12,className:"opacity-50"}):i.direcao==="asc"?t.jsx($,{size:12}):t.jsx(B,{size:12}),[i]),s.useCallback(e=>{E(o=>{const r=new Set(o);return r.has(e)?r.delete(e):r.add(e),r})},[]);const x=s.useMemo(()=>{let e=[...c];return i.campo&&e.sort((o,r)=>{let a=o[i.campo],n=r[i.campo];return i.campo.includes("dt_")&&(a=a?new Date(a):new Date(0),n=n?new Date(n):new Date(0)),i.campo==="vl_lancto"&&(a=parseFloat(a)||0,n=parseFloat(n)||0),typeof a=="string"&&(a=a.toLowerCase(),n=n.toLowerCase()),a<n?i.direcao==="asc"?-1:1:a>n?i.direcao==="asc"?1:-1:0}),e},[c,i]);s.useMemo(()=>{const e=(C-1)*u,o=e+u;return x.slice(e,o)},[x,C]),Math.ceil(x.length/u),s.useEffect(()=>{E(new Set)},[c]),s.useEffect(()=>{D(1)},[c]),s.useEffect(()=>{L(1)},[F]);const M=async(e=l)=>{g(!0),w("");try{const r={nr_ctapes:Array.isArray(e.nr_ctapes)&&e.nr_ctapes.length>0?e.nr_ctapes:d.map(n=>n.numero),dt_movim_ini:e.dt_movim_ini,dt_movim_fim:e.dt_movim_fim,limit:1e6,offset:0},a=await p.financial.extrato(r);if(a.success)b(a.data||[]),h(a.total||0);else throw new Error(a.message||"Erro ao buscar dados")}catch(o){console.error("Erro ao buscar extrato:",o),w("Erro ao buscar dados do servidor."),b([]),h(0)}finally{g(!1),z(!0)}j(!0),S("");try{const r={nr_ctapes:Array.isArray(e.nr_ctapes)&&e.nr_ctapes.length>0?e.nr_ctapes:d.map(n=>n.numero),dt_movim_ini:e.dt_movim_ini,dt_movim_fim:e.dt_movim_fim,limit:1e6,offset:0},a=await p.financial.extratoTotvs(r);if(a.success)y(a.data||[]),_(a.total||0);else throw new Error(a.message||"Erro ao buscar dados TOTVS")}catch(o){console.error("Erro ao buscar extrato TOTVS:",o),S("Erro ao buscar dados do servidor TOTVS."),y([]),_(0)}finally{j(!1)}},T=e=>{N({...l,[e.target.name]:e.target.value})},O=e=>{e.preventDefault(),D(1),M({...l,[e.target.name]:e.target.value})},k=Array.isArray(l.nr_ctapes)&&l.nr_ctapes.length>0?d.filter(e=>l.nr_ctapes.includes(e.numero)):d;s.useState(!1);let f=[];return k.length>0&&(f=k.map(e=>{const o=c.filter(a=>String(a.nr_ctapes)===e.numero&&!a.dt_conciliacao);let r=null;return o.length>0&&(r=o.reduce((a,n)=>{const U=new Date(n.dt_lancto);return!a||U<new Date(a)?n.dt_lancto:a},null)),{numero:e.numero,nome:e.nome,maisAntigaDesconciliada:r}}),f.sort((e,o)=>{const r=!!e.maisAntigaDesconciliada,a=!!o.maisAntigaDesconciliada;return r&&a?new Date(e.maisAntigaDesconciliada)-new Date(o.maisAntigaDesconciliada):r&&!a?-1:!r&&a?1:e.nome.localeCompare(o.nome)})),t.jsx(H,{message:"Erro ao carregar a página de Conciliação",onError:(e,o)=>{console.error("Conciliacao Error:",e,o)},children:t.jsxs("div",{className:"w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8",children:[t.jsx("h1",{className:"text-3xl font-bold mb-6 text-center text-[#000638]",children:"Conciliação"}),t.jsxs("div",{className:"mb-4",children:[t.jsxs("form",{onSubmit:O,className:"flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10",children:[t.jsxs("div",{className:"mb-6",children:[t.jsxs("span",{className:"text-lg font-bold text-[#000638] flex items-center gap-2",children:[t.jsx(V,{size:22,weight:"bold"}),"Filtros"]}),t.jsx("span",{className:"text-sm text-gray-500 mt-1",children:"Selecione o período e as contas para análise"})]}),t.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2 w-full mb-4",children:[t.jsxs("div",{className:"flex flex-col",children:[t.jsx("label",{className:"block text-xs font-semibold mb-1 text-[#000638]",children:"Contas"}),t.jsx(R,{contas:d,contasSelecionadas:Array.isArray(l.nr_ctapes)?l.nr_ctapes:[],setContasSelecionadas:e=>N(o=>({...o,nr_ctapes:typeof e=="function"?e(Array.isArray(o.nr_ctapes)?o.nr_ctapes:[]):e})),minWidth:200,maxWidth:400,placeholder:"Selecione as contas",hideLabel:!0,className:"!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-base"})]}),t.jsxs("div",{className:"flex flex-col",children:[t.jsx("label",{className:"block text-xs font-semibold mb-1 text-[#000638]",children:"Data Inicial"}),t.jsx("input",{type:"date",name:"dt_movim_ini",value:l.dt_movim_ini,onChange:T,className:"border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"})]}),t.jsxs("div",{className:"flex flex-col",children:[t.jsx("label",{className:"block text-xs font-semibold mb-1 text-[#000638]",children:"Data Final"}),t.jsx("input",{type:"date",name:"dt_movim_fim",value:l.dt_movim_fim,onChange:T,className:"border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"})]})]}),t.jsx("div",{className:"flex justify-end w-full mt-1",children:t.jsxs("button",{type:"submit",className:"flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed",disabled:m,children:[m?t.jsx(A,{size:18,className:"animate-spin"}):t.jsx(W,{size:18,weight:"bold"}),m?"Carregando...":"Filtrar"]})})]}),v&&t.jsx("div",{className:"mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center",children:v})]}),t.jsxs("div",{className:"rounded-2xl shadow-lg bg-white mb-4 border border-[#000638]/10 max-w-5xl mx-auto",children:[t.jsx("div",{className:"p-3 border-b border-[#000638]/10 select-none flex items-center justify-between",children:t.jsx("span",{className:"text-base font-bold text-[#000638]",children:"Transação desconciliada mais antiga por banco"})}),t.jsx("div",{className:"flex flex-row gap-2 p-3 flex-wrap justify-center items-stretch",children:f.map(e=>t.jsxs(Z,{className:"min-w-[140px] max-w-[180px] shadow-md rounded-lg bg-white cursor-pointer p-1 border border-gray-200",children:[t.jsx(q,{className:"pb-0 px-1 pt-1",children:t.jsx("div",{className:"flex flex-row items-center gap-1",children:t.jsx(J,{className:"text-xs font-bold text-blue-900 truncate",children:e.nome})})}),t.jsxs(K,{className:"pt-1 pl-2",children:[t.jsx("div",{className:"text-[10px] text-gray-500",children:"Data mais antiga desconciliada"}),t.jsx("div",{className:"text-xs font-bold text-gray-700 mt-0.5",children:m?t.jsx(A,{size:18,className:"animate-spin text-blue-600"}):e.maisAntigaDesconciliada?t.jsx("span",{className:"text-[#fe0000] font-bold",children:new Date(e.maisAntigaDesconciliada).toLocaleDateString("pt-BR")}):t.jsx("span",{className:"text-green-600 font-bold",children:"Conciliações realizadas no período"})})]})]},e.numero))})]})]})})};export{xe as default};
