// useFreshFetch — proteção universal contra race condition em fetches React.
//
// Bug que resolve: usuário troca filtro/mês → request A dispara.
// Antes de A chegar, troca de novo → request B dispara → chega antes.
// A chega depois e sobrescreve B com valor antigo (efeito "carrega → altera
// → zera"). Esse hook tagga cada chamada e descarta `setState` se outra
// request mais nova já voltou (ou se componente foi desmontado).
//
// Uso:
//   const { run, isStale } = useFreshFetch();
//
//   const carregar = useCallback(async () => {
//     const tok = run();
//     setLoading(true);
//     try {
//       const r = await fetch(url);
//       const j = await r.json();
//       if (isStale(tok)) return;        // resposta obsoleta → ignora
//       if (!j?.success) throw new Error(j?.message || 'Erro');
//       setData(j.data);
//     } catch (e) {
//       if (isStale(tok)) return;
//       setErro(e.message);
//     } finally {
//       if (!isStale(tok)) setLoading(false);
//     }
//   }, [filtros]);
import { useCallback, useEffect, useRef } from 'react';

export default function useFreshFetch() {
  const idRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Invalida qualquer request em voo ao desmontar
      idRef.current += 1;
    };
  }, []);

  const run = useCallback(() => ++idRef.current, []);
  const isStale = useCallback(
    (token) => !mountedRef.current || token !== idRef.current,
    [],
  );

  return { run, isStale };
}
