import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para debounce de valores
 * Útil para otimizar chamadas de API e validações
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Limpa timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Define novo timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedValue;
};

/**
 * Hook para debounce de callbacks
 * Útil para otimizar handlers de eventos
 */
export const useDebouncedCallback = (callback, delay = 300, deps = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Atualiza ref do callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args) => {
    // Limpa timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Define novo timeout
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay, ...deps]);

  // Cancela debounce pendente
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Executa imediatamente (flush)
  const flush = useCallback((...args) => {
    cancel();
    callbackRef.current(...args);
  }, [cancel]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    callback: debouncedCallback,
    cancel,
    flush
  };
};

/**
 * Hook para throttle de valores
 * Útil para eventos de scroll, resize, etc.
 */
export const useThrottle = (value, delay = 100) => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecuted = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted.current;

    if (timeSinceLastExecution >= delay) {
      setThrottledValue(value);
      lastExecuted.current = now;
    } else {
      const timeout = setTimeout(() => {
        setThrottledValue(value);
        lastExecuted.current = Date.now();
      }, delay - timeSinceLastExecution);

      return () => clearTimeout(timeout);
    }
  }, [value, delay]);

  return throttledValue;
};

/**
 * Hook para throttle de callbacks
 */
export const useThrottledCallback = (callback, delay = 100, deps = []) => {
  const lastExecuted = useRef(Date.now());
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Atualiza ref do callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted.current;

    if (timeSinceLastExecution >= delay) {
      callbackRef.current(...args);
      lastExecuted.current = now;
    } else {
      // Limpa timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Agenda execução
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        lastExecuted.current = Date.now();
      }, delay - timeSinceLastExecution);
    }
  }, [delay, ...deps]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
};