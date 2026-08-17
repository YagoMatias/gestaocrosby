// Chave do sessionStorage com as abas abertas.
// Fica fora do TabContext para que o logout (AuthContext) possa limpá-la
// sem depender do componente das abas.
export const TABS_STORAGE_KEY = 'crosby:abas';
