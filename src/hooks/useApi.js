import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE_URL, ERROR_MESSAGES, PERFORMANCE_CONFIG } from '../config/constants';

/**
 * Hook customizado para gerenciar chamadas de API
 * Implementa cache, retry logic, cancel requests e tratamento de erro
 */
export const useApi = (initialOptions = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRequestTime, setLastRequestTime] = useState(null);
  
  // Refs para controle
  const abortControllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const requestCountRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Gera chave do cache baseada na URL e params
   */
  const getCacheKey = useCallback((url, options = {}) => {
    const params = options.params ? JSON.stringify(options.params) : '';
    const method = options.method || 'GET';
    return `${method}:${url}:${params}`;
  }, []);

  /**
   * Verifica se o cache é válido
   */
  const isCacheValid = useCallback((timestamp) => {
    if (!timestamp) return false;
    return Date.now() - timestamp < PERFORMANCE_CONFIG.CACHE_DURATION;
  }, []);

  /**
   * Sanitiza dados de entrada para prevenir XSS
   */
  const sanitizeData = useCallback((data) => {
    if (typeof data === 'string') {
      return data.replace(/[<>]/g, '');
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = sanitizeData(value);
      }
      return sanitized;
    }
    return data;
  }, []);

  /**
   * Constrói URL com parâmetros
   */
  const buildUrl = useCallback((endpoint, params = {}) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    });
    
    return url.toString();
  }, []);

  /**
   * Executa requisição HTTP com todas as otimizações
   */
  const request = useCallback(async (endpoint, options = {}) => {
    // Previne múltiplas requisições simultâneas
    if (requestCountRef.current >= PERFORMANCE_CONFIG.MAX_CONCURRENT_REQUESTS) {
      throw new Error('Muitas requisições simultâneas. Tente novamente.');
    }

    const {
      method = 'GET',
      params = {},
      body,
      headers = {},
      useCache = true,
      retries = 2,
      timeout = 10000,
      ...restOptions
    } = { ...initialOptions, ...options };

    // Cancela requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Cria novo AbortController
    abortControllerRef.current = new AbortController();

    const url = buildUrl(endpoint, method === 'GET' ? params : {});
    const cacheKey = getCacheKey(url, { method, params });

    // Verifica cache
    if (useCache && method === 'GET') {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && isCacheValid(cached.timestamp)) {
        setData(cached.data);
        setError(null);
        setLastRequestTime(cached.timestamp);
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);
    requestCountRef.current++;

    let lastError = null;
    
    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Timeout Promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout da requisição')), timeout);
        });

        // Request Promise
        const requestPromise = fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(sanitizeData(body)) : undefined,
          signal: abortControllerRef.current.signal,
          ...restOptions,
        });

        const response = await Promise.race([requestPromise, timeoutPromise]);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || ERROR_MESSAGES.SERVER_ERROR}`);
        }

        const responseData = await response.json();
        const sanitizedData = sanitizeData(responseData);
        const timestamp = Date.now();

        // Salva no cache
        if (useCache && method === 'GET') {
          cacheRef.current.set(cacheKey, {
            data: sanitizedData,
            timestamp
          });
        }

        setData(sanitizedData);
        setError(null);
        setLastRequestTime(timestamp);
        setLoading(false);
        requestCountRef.current--;

        return sanitizedData;

      } catch (err) {
        lastError = err;
        
        // Não retry em caso de abort ou erro de validação
        if (err.name === 'AbortError' || err.message.includes('Timeout')) {
          break;
        }
        
        // Delay exponencial entre tentativas
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    requestCountRef.current--;
    setLoading(false);
    
    const errorMessage = lastError?.message || ERROR_MESSAGES.NETWORK_ERROR;
    setError(errorMessage);
    
    throw new Error(errorMessage);
  }, [initialOptions, buildUrl, getCacheKey, isCacheValid, sanitizeData]);

  /**
   * Métodos de conveniência para diferentes tipos de requisição
   */
  const get = useCallback((endpoint, params, options) => {
    return request(endpoint, { method: 'GET', params, ...options });
  }, [request]);

  const post = useCallback((endpoint, body, options) => {
    return request(endpoint, { method: 'POST', body, ...options });
  }, [request]);

  const put = useCallback((endpoint, body, options) => {
    return request(endpoint, { method: 'PUT', body, ...options });
  }, [request]);

  const del = useCallback((endpoint, options) => {
    return request(endpoint, { method: 'DELETE', ...options });
  }, [request]);

  /**
   * Cancela requisição em andamento
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Limpa cache
   */
  const clearCache = useCallback((pattern) => {
    if (pattern) {
      const keys = Array.from(cacheRef.current.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          cacheRef.current.delete(key);
        }
      });
    } else {
      cacheRef.current.clear();
    }
  }, []);

  /**
   * Reexecuta última requisição
   */
  const retry = useCallback(() => {
    // Implementar lógica de retry da última requisição se necessário
    setError(null);
    setLoading(false);
  }, []);

  return {
    // Estados
    data,
    loading,
    error,
    lastRequestTime,
    
    // Métodos principais
    request,
    get,
    post,
    put,
    del,
    
    // Utilitários
    cancel,
    clearCache,
    retry,
    
    // Informações
    isLoading: loading,
    hasError: !!error,
    hasData: !!data,
    cacheSize: cacheRef.current.size
  };
};