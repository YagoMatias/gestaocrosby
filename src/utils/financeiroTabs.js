// Chave do sessionStorage com as abas abertas do Financeiro.
// Fica fora do TabContext para que o logout (AuthContext) possa limpá-la
// sem depender do componente das abas.
export const FINANCEIRO_TABS_STORAGE_KEY = 'financeiro:abas';
