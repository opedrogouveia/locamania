'use client';

/**
 * Hooks extras da área de motos/manutenção/rastreamento que não estão em
 * `lib/queries` (mesmas chaves, para a invalidação central continuar valendo).
 */
import { ParameterKey } from '@locamania/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { maintenanceApi, motorcyclesApi } from '@/lib/api/resources';
import { K, useMaintenanceRecords, useParameters } from '@/lib/queries';

/** Um registro de manutenção (abre pelo link `?record=<id>`). */
export const useMaintenanceRecord = (id: string | null | undefined) =>
  useQuery({
    queryKey: [...K.maintenance, 'record', id],
    queryFn: () => maintenanceApi.record(id!),
    enabled: !!id,
  });

/** Planos de uma moto, com `enabled` (perfil sem `maintenance.view` não busca). Mesma chave de `useMotorcyclePlans`. */
export const usePlansOf = (motorcycleId: string, enabled = true) =>
  useQuery({
    queryKey: [...K.maintenance, 'plans', motorcycleId],
    queryFn: () => motorcyclesApi.plans(motorcycleId),
    enabled,
  });

/** Oficinas já usadas (sugestão no campo, para não virar dez grafias da mesma). */
export function useWorkshopSuggestions(enabled = true): string[] {
  const { data } = useMaintenanceRecords('done', { pageSize: 100 }, enabled);
  return useMemo(() => {
    const count = new Map<string, number>();
    for (const r of data?.data ?? []) {
      const w = r.workshop?.trim();
      if (w) count.set(w, (count.get(w) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
  }, [data]);
}

/** Parâmetro numérico das configurações (com o padrão enquanto carrega). */
export function useNumberParameter(key: ParameterKey, fallback: number): number {
  const { data } = useParameters();
  const p = data?.find((x) => x.key === key);
  const n = Number(p?.value ?? p?.defaultValue);
  return Number.isFinite(n) && p ? n : fallback;
}
