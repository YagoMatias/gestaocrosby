import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useMetasSemanais = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // =============================================================================
  // FUNÇÕES AUXILIARES PARA DATAS
  // =============================================================================

  /**
   * Obtém o primeiro dia da semana (segunda-feira) de uma data - ISO 8601
   */
  const obterInicioSemana = useCallback((data) => {
    const date = new Date(data);
    const day = date.getDay();
    // Domingo = 0, Segunda = 1, etc.
    // ISO 8601: Segunda-feira é o primeiro dia da semana
    const diff = day === 0 ? -6 : 1 - day; // Ajusta para segunda-feira
    const inicioSemana = new Date(date);
    inicioSemana.setDate(date.getDate() + diff);
    return inicioSemana.toISOString().split('T')[0];
  }, []);

  /**
   * Obtém o último dia da semana (domingo) de uma data - ISO 8601
   */
  const obterFimSemana = useCallback((data) => {
    const date = new Date(data);
    const day = date.getDay();
    // Domingo = 0, Segunda = 1, etc.
    // ISO 8601: Domingo é o último dia da semana
    const diff = day === 0 ? 0 : 7 - day; // Ajusta para domingo
    const fimSemana = new Date(date);
    fimSemana.setDate(date.getDate() + diff);
    return fimSemana.toISOString().split('T')[0];
  }, []);

  /**
   * Obtém o número da semana do ano (método ISO 8601 correto)
   */
  const obterSemanaAnoISO = useCallback((data) => {
    const date = new Date(data);
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7; // Segunda-feira = 0, Domingo = 6
    target.setDate(target.getDate() - dayNr + 3); // Vai para a quinta-feira da semana
    const firstThursday = target.valueOf();
    target.setMonth(0, 1); // 1º de janeiro
    if (target.getDay() !== 4) {
      // Se não for quinta-feira
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 dias em ms
  }, []);

  /**
   * Obtém o número da semana no mês (1-5) - mantido para compatibilidade
   */
  const obterNumeroSemanaMes = useCallback(
    (data) => {
      const date = new Date(data);
      const primeiroDia = new Date(date.getFullYear(), date.getMonth(), 1);
      const inicioSemanaPrimeiroDia = new Date(obterInicioSemana(primeiroDia));
      const inicioSemanaData = new Date(obterInicioSemana(data));

      const diffTime = inicioSemanaData - inicioSemanaPrimeiroDia;
      const diffWeeks = Math.ceil(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;

      return Math.min(diffWeeks, 5); // Máximo 5 semanas
    },
    [obterInicioSemana],
  );

  /**
   * Gera todas as semanas de um mês seguindo ISO 8601
   */
  const gerarSemanasDoMes = useCallback(
    (mes) => {
      const [ano, mesNum] = mes.split('-');
      const primeiroDia = new Date(parseInt(ano), parseInt(mesNum) - 1, 1);
      const ultimoDia = new Date(parseInt(ano), parseInt(mesNum), 0);


      const semanas = [];

      // Encontrar a primeira segunda-feira do mês (ou antes, se o mês começar no meio da semana)
      let dataInicio = new Date(obterInicioSemana(primeiroDia));

      // Se a primeira segunda-feira for antes do primeiro dia do mês, começar do primeiro dia
      if (dataInicio < primeiroDia) {
        dataInicio = new Date(primeiroDia);
      }

      let semanaAtual = 1;

      // Gerar semanas seguindo ISO 8601 (segunda a domingo)
      while (dataInicio <= ultimoDia) {
        // Calcular fim da semana (domingo)
        const dataFim = new Date(obterFimSemana(dataInicio));

        // Se a data fim ultrapassar o último dia do mês, ajustar
        if (dataFim > ultimoDia) {
          dataFim.setTime(ultimoDia.getTime());
        }

        // Obter número da semana do ano (ISO 8601)
        const semanaAno = obterSemanaAnoISO(dataInicio);

        const semana = {
          numero: semanaAtual, // Número sequencial no mês (1, 2, 3, 4, 5)
          numeroAno: semanaAno, // Número da semana no ano (ISO 8601)
          inicio: dataInicio.toISOString().split('T')[0],
          fim: dataFim.toISOString().split('T')[0],
          label: `Semana ${semanaAtual} (${semanaAno})`,
          periodo: `${dataInicio.toISOString().split('T')[0]} a ${
            dataFim.toISOString().split('T')[0]
          }`,
          diasSemana: {
            segunda: dataInicio.toISOString().split('T')[0],
            terca: new Date(dataInicio.getTime() + 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            quarta: new Date(dataInicio.getTime() + 2 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            quinta: new Date(dataInicio.getTime() + 3 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            sexta: new Date(dataInicio.getTime() + 4 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            sabado: new Date(dataInicio.getTime() + 5 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            domingo: dataFim.toISOString().split('T')[0],
          },
        };

        semanas.push(semana);


        // Próxima semana começa na segunda-feira seguinte
        dataInicio.setDate(dataInicio.getDate() + 7);
        semanaAtual++;
      }

      return semanas;
    },
    [obterInicioSemana, obterFimSemana, obterSemanaAnoISO],
  );

  // =============================================================================
  // FUNÇÕES AUXILIARES PARA CÁLCULOS DE METAS
  // =============================================================================

  /**
   * Calcula metas semanais a partir de uma meta mensal
   */
  const calcularMetasSemanaisDeMensal = useCallback(
    (metaMensal, numeroSemanas) => {
      const valorPorSemana = metaMensal / numeroSemanas;
      return {
        bronze: Math.round(valorPorSemana * 100) / 100,
        prata: Math.round(valorPorSemana * 100) / 100,
        ouro: Math.round(valorPorSemana * 100) / 100,
        diamante: Math.round(valorPorSemana * 100) / 100,
      };
    },
    [],
  );

  /**
   * Calcula meta mensal a partir das metas semanais
   */
  const calcularMetaMensalDeSemanais = useCallback((metasSemanais) => {
    const total = metasSemanais.reduce(
      (acc, semana) => {
        return {
          bronze: acc.bronze + (semana.metas.bronze || 0),
          prata: acc.prata + (semana.metas.prata || 0),
          ouro: acc.ouro + (semana.metas.ouro || 0),
          diamante: acc.diamante + (semana.metas.diamante || 0),
        };
      },
      { bronze: 0, prata: 0, ouro: 0, diamante: 0 },
    );

    return {
      bronze: Math.round(total.bronze * 100) / 100,
      prata: Math.round(total.prata * 100) / 100,
      ouro: Math.round(total.ouro * 100) / 100,
      diamante: Math.round(total.diamante * 100) / 100,
    };
  }, []);

  // =============================================================================
  // OPERAÇÕES CRUD PARA METAS SEMANAIS
  // =============================================================================

  /**
   * Salva uma única meta semanal no banco
   */
  const salvarMetaSemanalIndividual = useCallback(
    async (metaData) => {
      setLoading(true);
      setError(null);

      try {

        const { tipo, nome, mes, semana, nivel, valor, usuario } = metaData;

        // Gerar semanas do mês para obter as datas
        const semanasDoMes = gerarSemanasDoMes(mes);
        const semanaData = semanasDoMes.find((s) => s.numero === semana);

        if (!semanaData) {
          throw new Error(`Semana ${semana} não encontrada para o mês ${mes}`);
        }

        const metaParaInserir = {
          tipo: tipo,
          nome: nome,
          semana_inicio: semanaData.inicio,
          semana_fim: semanaData.fim,
          campo: nivel,
          valor: parseFloat(valor),
          mes_referencia: mes,
          numero_semana: semana,
          usuario: usuario,
          data_alteracao: new Date().toISOString(),
        };


        // Verificar conectividade antes de tentar salvar
        try {
          // Teste simples de conectividade
          const { error: testError } = await supabase
            .from('metas_semanais_varejo')
            .select('id')
            .limit(1);

          if (testError) {
            throw new Error(`Erro de conectividade: ${testError.message}`);
          }
        } catch (connectError) {
          throw new Error(
            `Falha na conexão com o banco de dados: ${connectError.message}`,
          );
        }

        // Usar UPSERT para evitar duplicatas
        const { data, error: upsertError } = await supabase
          .from('metas_semanais_varejo')
          .upsert([metaParaInserir], {
            onConflict: 'tipo,nome,campo,semana_inicio',
            ignoreDuplicates: false,
          })
          .select();

        if (upsertError) {
          throw upsertError;
        }


        return {
          success: true,
          data: data,
        };
      } catch (error) {
        console.error('❌ Erro ao salvar meta semanal:', error);

        // Determinar se é erro de conectividade
        const isNetworkError =
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('ERR_NAME_NOT_RESOLVED') ||
          error.message?.includes('NetworkError');

        const errorMessage = isNetworkError
          ? 'Erro de conexão. Verifique sua internet e tente novamente.'
          : error.message || 'Erro desconhecido ao salvar meta semanal';

        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    [gerarSemanasDoMes],
  );

  /**
   * Salva meta mensal e automaticamente calcula as metas semanais
   */
  const salvarMetaMensalComCalculoSemanal = useCallback(
    async (tipo, nome, mes, nivel, valor, usuario) => {
      setLoading(true);
      setError(null);

      try {

        // Gerar semanas do mês
        const semanasDoMes = gerarSemanasDoMes(mes);
        const numeroSemanas = semanasDoMes.length;

        // Calcular metas semanais a partir da meta mensal
        const metasSemanais = calcularMetasSemanaisDeMensal(
          valor,
          numeroSemanas,
        );


        // Preparar dados para inserção das metas semanais
        const metasParaInserir = [];

        semanasDoMes.forEach((semana) => {
          metasParaInserir.push({
            tipo: tipo,
            nome: nome,
            semana_inicio: semana.inicio,
            semana_fim: semana.fim,
            campo: nivel,
            valor: metasSemanais[nivel],
            mes_referencia: mes,
            numero_semana: semana.numero,
            usuario: usuario,
            data_alteracao: new Date().toISOString(),
          });
        });


        // Inserir todas as metas semanais
        const { data, error: upsertError } = await supabase
          .from('metas_semanais_varejo')
          .upsert(metasParaInserir, {
            onConflict: 'tipo,nome,campo,semana_inicio',
            ignoreDuplicates: false,
          })
          .select();

        if (upsertError) {
          throw upsertError;
        }


        return {
          success: true,
          data: data,
          metasSemanais: metasSemanais,
        };
      } catch (error) {
        console.error(
          '❌ Erro ao salvar meta mensal com cálculo semanal:',
          error,
        );
        setError(error.message);
        return {
          success: false,
          error: error.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [gerarSemanasDoMes, calcularMetasSemanaisDeMensal],
  );

  /**
   * Salva metas semanais no banco
   */
  const salvarMetasSemanais = useCallback(async (metasData) => {
    setLoading(true);
    setError(null);

    try {
      const metasParaInserir = [];

      metasData.forEach(
        ({
          tipo,
          nome,
          semana_inicio,
          semana_fim,
          metas,
          mes_referencia,
          numero_semana,
          usuario,
        }) => {
          Object.entries(metas).forEach(([campo, valor]) => {
            if (valor && valor > 0) {
              metasParaInserir.push({
                tipo: tipo,
                nome: nome,
                semana_inicio: semana_inicio,
                semana_fim: semana_fim,
                campo: campo,
                valor: parseFloat(valor),
                mes_referencia: mes_referencia,
                numero_semana: numero_semana,
                usuario: usuario,
                data_alteracao: new Date().toISOString(),
              });
            }
          });
        },
      );

      if (metasParaInserir.length === 0) {
        throw new Error('Nenhuma meta válida para salvar');
      }

      // Usar UPSERT para evitar duplicatas
      const { data, error: upsertError } = await supabase
        .from('metas_semanais_varejo')
        .upsert(metasParaInserir, {
          onConflict: 'tipo,nome,campo,semana_inicio',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        throw upsertError;
      }

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Busca metas semanais por período
   */
  const buscarMetasSemanais = useCallback(
    async (mesInicio, mesFim, tipo = null) => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('metas_semanais_varejo')
          .select('*')
          .gte('mes_referencia', mesInicio)
          .lte('mes_referencia', mesFim)
          .order('numero_semana', { ascending: true })
          .order('tipo', { ascending: true })
          .order('nome', { ascending: true });

        if (tipo) {
          query = query.eq('tipo', tipo);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        return { success: true, data: data || [] };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Busca metas mensais calculadas (derivadas das semanais)
   */
  const buscarMetasMensaisCalculadas = useCallback(
    async (mesInicio, mesFim, tipo = null) => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('metas_mensais_calculadas')
          .select('*')
          .gte('mes', mesInicio)
          .lte('mes', mesFim)
          .order('mes', { ascending: true });

        if (tipo) {
          query = query.eq('tipo', tipo);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        return { success: true, data: data || [] };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Busca metas semanais agrupadas por entidade e semana
   */
  const buscarMetasSemanaisAgrupadas = useCallback(async (mes) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('metas_semanais_varejo')
        .select('*')
        .eq('mes_referencia', mes)
        .order('numero_semana', { ascending: true })
        .order('tipo', { ascending: true })
        .order('nome', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Agrupar dados por entidade e semana
      const agrupado = {};

      (data || []).forEach((meta) => {
        const chave = `${meta.tipo}-${meta.nome}`;
        if (!agrupado[chave]) {
          agrupado[chave] = {
            tipo: meta.tipo,
            nome: meta.nome,
            semanas: {},
          };
        }

        if (!agrupado[chave].semanas[meta.numero_semana]) {
          agrupado[chave].semanas[meta.numero_semana] = {
            numero: meta.numero_semana,
            inicio: meta.semana_inicio,
            fim: meta.semana_fim,
            metas: {},
          };
        }

        agrupado[chave].semanas[meta.numero_semana].metas[meta.campo] =
          meta.valor;
      });

      return { success: true, data: agrupado };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deleta meta semanal específica
   */
  const deletarMetaSemanal = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('metas_semanais_varejo')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deleta metas mensais calculadas por critérios
   */
  const deletarMetasMensaisCalculadas = useCallback(async (criterios) => {
    setLoading(true);
    setError(null);

    try {

      let query = supabase.from('metas_mensais_calculadas').delete();

      // Aplicar filtros baseados nos critérios
      if (criterios.mes) {
        query = query.eq('mes', criterios.mes);
      }
      if (criterios.tipo) {
        query = query.eq('tipo', criterios.tipo);
      }
      if (criterios.nome) {
        query = query.eq('nome', criterios.nome);
      }

      const { data, error: deleteError } = await query;

      if (deleteError) {
        throw deleteError;
      }

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      console.error('❌ Erro ao excluir metas mensais calculadas:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deleta metas semanais por critérios específicos
   */
  const deletarMetasSemanaisPorCriterios = useCallback(async (criterios) => {
    setLoading(true);
    setError(null);

    try {

      // Verificar se temos os critérios mínimos necessários
      if (!criterios.mes) {
        throw new Error('Mês é obrigatório para excluir metas semanais');
      }

      let query = supabase.from('metas_semanais_varejo').delete();

      // Aplicar filtros baseados nos critérios
      query = query.eq('mes_referencia', criterios.mes);

      if (criterios.tipo) {
        query = query.eq('tipo', criterios.tipo);
      }
      if (criterios.nome) {
        query = query.eq('nome', criterios.nome);
      }
      if (criterios.semana) {
        query = query.eq('numero_semana', criterios.semana);
      }
      if (criterios.nivel) {
        query = query.eq('campo', criterios.nivel);
      }

      const { data, error: deleteError } = await query;

      if (deleteError) {
        console.error('❌ Erro ao excluir metas semanais:', deleteError);
        throw deleteError;
      }

      return { success: true, data };
    } catch (err) {
      console.error('❌ Erro ao excluir metas semanais:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Força recálculo das metas mensais
   */
  const recalcularMetasMensais = useCallback(
    async (mes, tipo = null, nome = null) => {
      setLoading(true);
      setError(null);

      try {
        // Buscar todas as metas semanais do mês
        let query = supabase
          .from('metas_semanais_varejo')
          .select('*')
          .eq('mes_referencia', mes);

        if (tipo) {
          query = query.eq('tipo', tipo);
        }

        if (nome) {
          query = query.eq('nome', nome);
        }

        const { data: metasSemanais, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        // Agrupar e calcular totais
        const totais = {};

        (metasSemanais || []).forEach((meta) => {
          const chave = `${meta.tipo}-${meta.nome}`;
          if (!totais[chave]) {
            totais[chave] = {
              tipo: meta.tipo,
              nome: meta.nome,
              mes: meta.mes_referencia,
              bronze: 0,
              prata: 0,
              ouro: 0,
              diamante: 0,
            };
          }

          totais[chave][meta.campo] += parseFloat(meta.valor || 0);
        });

        // Inserir/atualizar metas mensais calculadas
        const metasParaInserir = Object.values(totais).map((total) => ({
          ...total,
          calculado_em: new Date().toISOString(),
          usuario: 'Sistema',
        }));

        if (metasParaInserir.length > 0) {
          const { error: upsertError } = await supabase
            .from('metas_mensais_calculadas')
            .upsert(metasParaInserir, {
              onConflict: 'tipo,nome,mes',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            throw upsertError;
          }
        }

        return { success: true, data: metasParaInserir };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Função para buscar log de alterações de metas semanais
  const buscarLogAlteracoesSemanais = useCallback(
    async (mesInicio = null, mesFim = null) => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('metas_semanais_varejo')
          .select('*')
          .order('data_alteracao', { ascending: false });

        if (mesInicio && mesFim) {
          query = query
            .gte('mes_referencia', mesInicio)
            .lte('mes_referencia', mesFim);
        }

        const { data, error: fetchError } = await query.limit(100);

        if (fetchError) {
          throw fetchError;
        }

        return { success: true, data: data || [] };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,

    // Funções auxiliares
    obterInicioSemana,
    obterFimSemana,
    obterNumeroSemanaMes,
    obterSemanaAnoISO,
    gerarSemanasDoMes,
    calcularMetasSemanaisDeMensal,
    calcularMetaMensalDeSemanais,

    // Operações CRUD
    salvarMetaSemanalIndividual,
    salvarMetaMensalComCalculoSemanal,
    salvarMetasSemanais,
    buscarMetasSemanais,
    buscarMetasMensaisCalculadas,
    buscarMetasSemanaisAgrupadas,
    deletarMetaSemanal,
    deletarMetasSemanaisPorCriterios,
    deletarMetasMensaisCalculadas,
    recalcularMetasMensais,
    buscarLogAlteracoesSemanais,
  };
};

export default useMetasSemanais;
