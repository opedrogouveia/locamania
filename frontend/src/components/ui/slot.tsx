'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Slot mínimo (padrão Radix asChild, sem a dependência): clona o único filho,
 * mesclando className e props. Útil para `<Button asChild><Link/></Button>`.
 */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ children, className, ...props }, ref) => {
    if (!React.isValidElement(children)) {
      return null;
    }

    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props;

    return React.cloneElement(child, {
      ...props,
      ...childProps,
      className: cn(className, childProps.className as string | undefined),
      ref,
    } as Record<string, unknown>);
  },
);
Slot.displayName = 'Slot';
