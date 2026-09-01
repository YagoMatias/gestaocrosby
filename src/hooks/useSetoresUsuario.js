import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import { getSetoresDoUsuario } from '../services/setoresService';

/**
 * Hook com os setores do usuário logado (como membro ou como gestor).
 * Use para liberar ações por setor, ex.: `temSetor('FINANCEIRO')`.
 */
export const useSetoresUsuario = () => {
  const { user } = useAuth() || {};
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      if (!user?.id) {
        setSetores([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await getSetoresDoUsuario(user.id);
      if (!cancelado) {
        setSetores(data || []);
        setLoading(false);
      }
    };

    carregar();
    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  const temSetor = useCallback(
    (nome) => setores.includes(nome),
    [setores],
  );

  const temAlgumSetor = useCallback(
    (nomes) => nomes.some((nome) => setores.includes(nome)),
    [setores],
  );

  return { setores, temSetor, temAlgumSetor, loading };
};

export default useSetoresUsuario;
