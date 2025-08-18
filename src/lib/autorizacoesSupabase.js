import { supabase } from './supabase';

// Funções para gerenciar autorizações no Supabase
export const autorizacoesSupabase = {
  // Buscar todas as autorizações
  async buscarAutorizacoes() {
    try {
      const { data, error } = await supabase
        .from('contas_autorizacoes')
        .select('*')
        .order('autorizado_em', { ascending: false });
      
      if (error) throw error;
      
      // Converter para o formato usado no frontend
      const autorizacoes = {};
      data.forEach(item => {
        autorizacoes[item.chave_unica] = item.autorizado_por;
      });
      
      return { data: autorizacoes, error: null };
    } catch (error) {
      console.error('Erro ao buscar autorizações:', error);
      return { data: null, error };
    }
  },

  // Autorizar uma conta
  async autorizarConta(chaveUnica, dadosConta, autorizadoPor) {
    try {
      const { data, error } = await supabase
        .from('contas_autorizacoes')
        .upsert({
          chave_unica: chaveUnica,
          cd_fornecedor: dadosConta.cd_fornecedor,
          nr_duplicata: dadosConta.nr_duplicata,
          cd_empresa: dadosConta.cd_empresa,
          nr_parcela: dadosConta.nr_parcela,
          autorizado_por: autorizadoPor,
          autorizado_em: new Date().toISOString()
        }, {
          onConflict: 'chave_unica'
        })
        .select();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Erro ao autorizar conta:', error);
      return { data: null, error };
    }
  },

  // Remover autorização de uma conta
  async removerAutorizacao(chaveUnica) {
    try {
      const { error } = await supabase
        .from('contas_autorizacoes')
        .delete()
        .eq('chave_unica', chaveUnica);
      
      if (error) throw error;
      return { data: true, error: null };
    } catch (error) {
      console.error('Erro ao remover autorização:', error);
      return { data: null, error };
    }
  },

  // Autorizar múltiplas contas
  async autorizarMultiplasContas(contas, autorizadoPor) {
    try {
      const dadosParaInserir = contas.map(grupo => ({
        chave_unica: `${grupo.item.cd_fornecedor}|${grupo.item.nr_duplicata}|${grupo.item.cd_empresa}|${grupo.item.nr_parcela}`,
        cd_fornecedor: grupo.item.cd_fornecedor,
        nr_duplicata: grupo.item.nr_duplicata,
        cd_empresa: grupo.item.cd_empresa,
        nr_parcela: grupo.item.nr_parcela,
        autorizado_por: autorizadoPor,
        autorizado_em: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('contas_autorizacoes')
        .upsert(dadosParaInserir, {
          onConflict: 'chave_unica'
        })
        .select();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Erro ao autorizar múltiplas contas:', error);
      return { data: null, error };
    }
  },

  // Remover múltiplas autorizações
  async removerMultiplasAutorizacoes(contas) {
    try {
      const chavesUnicas = contas.map(grupo => 
        `${grupo.item.cd_fornecedor}|${grupo.item.nr_duplicata}|${grupo.item.cd_empresa}|${grupo.item.nr_parcela}`
      );

      const { error } = await supabase
        .from('contas_autorizacoes')
        .delete()
        .in('chave_unica', chavesUnicas);
      
      if (error) throw error;
      return { data: true, error: null };
    } catch (error) {
      console.error('Erro ao remover múltiplas autorizações:', error);
      return { data: null, error };
    }
  },

  // Buscar autorizações por período
  async buscarAutorizacoesPorPeriodo(dataInicio, dataFim) {
    try {
      const { data, error } = await supabase
        .from('contas_autorizacoes')
        .select('*')
        .gte('autorizado_em', dataInicio)
        .lte('autorizado_em', dataFim)
        .order('autorizado_em', { ascending: false });
      
      if (error) throw error;
      
      const autorizacoes = {};
      data.forEach(item => {
        autorizacoes[item.chave_unica] = item.autorizado_por;
      });
      
      return { data: autorizacoes, error: null };
    } catch (error) {
      console.error('Erro ao buscar autorizações por período:', error);
      return { data: null, error };
    }
  },

  // Buscar estatísticas de autorizações
  async buscarEstatisticasAutorizacoes() {
    try {
      const { data, error } = await supabase
        .from('contas_autorizacoes')
        .select('autorizado_por, autorizado_em')
        .order('autorizado_em', { ascending: false });
      
      if (error) throw error;
      
      // Agrupar por autorizador
      const estatisticas = {};
      data.forEach(item => {
        if (!estatisticas[item.autorizado_por]) {
          estatisticas[item.autorizado_por] = 0;
        }
        estatisticas[item.autorizado_por]++;
      });
      
      return { data: estatisticas, error: null };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return { data: null, error };
    }
  }
};
