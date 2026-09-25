'use client';

import { ChevronDown, Download, Eye, FileText, Printer } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toaster';
import { downloadFile, errorMessage, objectUrl, openFile } from '@/lib/api/client';
import { contractsApi } from '@/lib/api/resources';
import { cn } from '@/lib/utils';

/**
 * Imprime um PDF autenticado. No computador abre a janela de impressão direto
 * (iframe escondido); no celular abre o PDF, que tem "imprimir/compartilhar".
 */
async function printPdf(path: string): Promise<void> {
  if (window.matchMedia('(pointer: coarse)').matches) return openFile(path);
  const url = await objectUrl(path);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  frame.src = url;
  frame.onload = () =>
    setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        void openFile(path);
      }
    }, 150);
  document.body.append(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
}

export function useContractPdf(contract: { id: string; number: string }) {
  const path = contractsApi.pdfPath(contract.id);
  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return {
    view: () => run(() => openFile(path)),
    download: () => run(() => downloadFile(path, `${contract.number}.pdf`)),
    print: () => run(() => printPdf(path)),
  };
}

/** Botão "Contrato (PDF)" com ver, baixar e imprimir (§10). */
export function ContractPdfMenu({
  contract,
  className,
  label = 'PDF',
}: {
  contract: { id: string; number: string };
  className?: string;
  label?: string;
}) {
  const pdf = useContractPdf(contract);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-card px-4 text-sm font-medium transition-colors hover:bg-accent [&_svg]:size-4',
          className,
        )}
      >
        <FileText /> {label} <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={pdf.view}>
          <Eye /> Ver contrato
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pdf.download}>
          <Download /> Baixar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pdf.print}>
          <Printer /> Imprimir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
