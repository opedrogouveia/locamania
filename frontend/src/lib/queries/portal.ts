'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { portalApi } from '../api/portal';

const P = ['portal'] as const;

/** Hooks do app do cliente. Voltar ao app atualiza (refetchOnWindowFocus). */
export const usePortalHome = () => useQuery({ queryKey: [...P, 'home'], queryFn: portalApi.home, refetchInterval: 120_000 });
export const usePortalCharges = () => useQuery({ queryKey: [...P, 'charges'], queryFn: portalApi.charges });
export const usePortalCharge = (id: string, poll = false) =>
  useQuery({ queryKey: [...P, 'charge', id], queryFn: () => portalApi.charge(id), refetchInterval: poll ? 4_000 : false });
export const usePortalMotorcycle = () => useQuery({ queryKey: [...P, 'motorcycle'], queryFn: portalApi.motorcycle });
export const usePortalMaintenance = () => useQuery({ queryKey: [...P, 'maintenance'], queryFn: portalApi.maintenance });
export const usePortalContract = () => useQuery({ queryKey: [...P, 'contract'], queryFn: portalApi.contract });
export const usePortalContractText = (enabled: boolean) => useQuery({ queryKey: [...P, 'contract-text'], queryFn: portalApi.contractText, enabled });
export const usePortalProfile = () => useQuery({ queryKey: [...P, 'profile'], queryFn: portalApi.profile });
export const usePortalSupportInfo = () => useQuery({ queryKey: [...P, 'support-info'], queryFn: portalApi.supportInfo, staleTime: 10 * 60_000 });
export const usePortalSupport = () => useQuery({ queryKey: [...P, 'support'], queryFn: portalApi.support });
export const usePortalDocuments = () => useQuery({ queryKey: [...P, 'documents'], queryFn: portalApi.documents });
export const usePortalNotifications = (page = 1) =>
  useQuery({ queryKey: [...P, 'notifications', page], queryFn: () => portalApi.notifications(page), refetchInterval: 60_000 });

function usePortalAction<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: P });
      void qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export const usePix = () => usePortalAction((id: string) => portalApi.pix(id));
export const usePortalSimulatePix = () => usePortalAction((id: string) => portalApi.simulatePix(id));
export const useReportOdometer = () => usePortalAction((km: number) => portalApi.reportOdometer(km));
export const useAcceptContract = () => usePortalAction((password: string) => portalApi.acceptContract(password));
export const useSendSupport = () => usePortalAction(portalApi.sendSupport);
export const usePortalMarkRead = () => usePortalAction((ids?: string[]) => portalApi.read(ids));
