import { useState, useCallback } from 'react';
import api from '../services/api';

export function useApi<T = any>(url: string) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (params?: Record<string, any>) => {
    setCarregando(true);
    setErro(null);
    try {
      const { data } = await api.get(url, { params });
      setDados(data);
      return data;
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    } finally {
      setCarregando(false);
    }
  }, [url]);

  return { dados, carregando, erro, carregar, setDados };
}
