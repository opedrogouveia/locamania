'use client';

import { formatCep, formatCpf, formatPhone, onlyDigits } from '@locamania/shared';
import { forwardRef, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { Input, type InputProps } from './input';

type Mask = 'cpf' | 'cep' | 'phone' | 'plate' | 'digits';

const FORMAT: Record<Mask, (v: string) => string> = {
  cpf: formatCpf,
  cep: formatCep,
  phone: formatPhone,
  plate: (v) => v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8),
  digits: (v) => onlyDigits(v),
};

const INPUT_MODE: Record<Mask, InputProps['inputMode']> = {
  cpf: 'numeric',
  cep: 'numeric',
  phone: 'tel',
  plate: 'text',
  digits: 'numeric',
};

/**
 * Campo com máscara enquanto digita (CPF, CEP, telefone, placa). `onValue`
 * recebe o valor "limpo" (só dígitos; placa em maiúsculas) — é o que a API grava.
 */
export const MaskedInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'value' | 'onChange'> & { mask: Mask; value: string | null | undefined; onValue: (value: string) => void }
>(({ mask, value, onValue, className, ...props }, ref) => (
  <Input
    ref={ref}
    inputMode={INPUT_MODE[mask]}
    autoComplete="off"
    value={FORMAT[mask](value ?? '')}
    onChange={(e) => onValue(mask === 'plate' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) : onlyDigits(e.target.value))}
    className={cn(mask === 'plate' && 'font-mono uppercase tracking-wider', className)}
    {...props}
  />
));
MaskedInput.displayName = 'MaskedInput';

function toDisplay(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Dinheiro em R$: digita-se só números e a vírgula aparece sozinha
 * ("35000" → "350,00") — o jeito dos apps de banco, sem erro de separador.
 * `onValue` recebe string decimal ("350.00") ou "" se vazio.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'value' | 'onChange'> & { value: string | number | null | undefined; onValue: (value: string) => void }
>(({ value, onValue, className, ...props }, ref) => {
  const [text, setText] = useState(toDisplay(value));
  useEffect(() => {
    const current = text ? (Number(onlyDigits(text)) / 100).toFixed(2) : '';
    const incoming = value === null || value === undefined || value === '' ? '' : Number(String(value).replace(',', '.')).toFixed(2);
    if (current !== incoming) setText(toDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const digits = onlyDigits(e.target.value).slice(0, 11);
          if (!digits) {
            setText('');
            onValue('');
            return;
          }
          const cents = Number(digits);
          setText((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          onValue((cents / 100).toFixed(2));
        }}
        className={cn('pl-9 tabular', className)}
        {...props}
      />
    </div>
  );
});
MoneyInput.displayName = 'MoneyInput';

/** Número inteiro (km, ano) com separador de milhar enquanto digita. */
export const NumberInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'value' | 'onChange'> & { value: number | null | undefined; onValue: (value: number | null) => void; suffix?: string; thousands?: boolean }
>(({ value, onValue, suffix, thousands = true, className, ...props }, ref) => (
  <div className="relative">
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      value={value === null || value === undefined ? '' : thousands ? value.toLocaleString('pt-BR') : String(value)}
      onChange={(e) => {
        const digits = onlyDigits(e.target.value).slice(0, 9);
        onValue(digits ? Number(digits) : null);
      }}
      className={cn(suffix && 'pr-10', 'tabular', className)}
      {...props}
    />
    {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
  </div>
));
NumberInput.displayName = 'NumberInput';
