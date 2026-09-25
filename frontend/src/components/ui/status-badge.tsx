import type {
  ChargeDisplayStatus,
  ContractStatus,
  CustomerStatus,
  ExpiryState,
  MaintenanceDueStatus,
  MaintenanceStatus,
  MotorcycleStatus,
  OccurrenceStatus,
  SupportMessageStatus,
} from '@locamania/shared';

import {
  CHARGE_STATUS_VARIANT,
  CONTRACT_STATUS_VARIANT,
  CUSTOMER_STATUS_VARIANT,
  EXPIRY_VARIANT,
  LABELS,
  MAINTENANCE_DUE_VARIANT,
  MAINTENANCE_STATUS_VARIANT,
  MOTORCYCLE_STATUS_VARIANT,
  OCCURRENCE_STATUS_VARIANT,
  SUPPORT_STATUS_VARIANT,
} from '@/lib/meta';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

function Dotted({ variant, label, className }: { variant: React.ComponentProps<typeof Badge>['variant']; label: string; className?: string }) {
  return (
    <Badge variant={variant} className={cn('gap-1.5', className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}

export const MotorcycleStatusBadge = ({ status, className }: { status: MotorcycleStatus; className?: string }) => (
  <Dotted variant={MOTORCYCLE_STATUS_VARIANT[status]} label={LABELS.motorcycle[status]} className={className} />
);

export const ChargeStatusBadge = ({ status, className }: { status: ChargeDisplayStatus; className?: string }) => (
  <Dotted variant={CHARGE_STATUS_VARIANT[status]} label={LABELS.charge[status]} className={className} />
);

export const CustomerStatusBadge = ({ status, className }: { status: CustomerStatus; className?: string }) => (
  <Dotted variant={CUSTOMER_STATUS_VARIANT[status]} label={LABELS.customer[status]} className={className} />
);

export const ContractStatusBadge = ({ status, className }: { status: ContractStatus; className?: string }) => (
  <Dotted variant={CONTRACT_STATUS_VARIANT[status]} label={LABELS.contract[status]} className={className} />
);

export const MaintenanceDueBadge = ({ status, className }: { status: MaintenanceDueStatus; className?: string }) => (
  <Dotted variant={MAINTENANCE_DUE_VARIANT[status]} label={LABELS.maintenanceDue[status]} className={className} />
);

export const MaintenanceStatusBadge = ({ status, className }: { status: MaintenanceStatus; className?: string }) => (
  <Dotted variant={MAINTENANCE_STATUS_VARIANT[status]} label={LABELS.maintenance[status]} className={className} />
);

export const OccurrenceStatusBadge = ({ status, className }: { status: OccurrenceStatus; className?: string }) => (
  <Dotted variant={OCCURRENCE_STATUS_VARIANT[status]} label={LABELS.occurrence[status]} className={className} />
);

export const SupportStatusBadge = ({ status, className }: { status: SupportMessageStatus; className?: string }) => (
  <Dotted variant={SUPPORT_STATUS_VARIANT[status]} label={LABELS.support[status]} className={className} />
);

export const ExpiryBadge = ({ state, className }: { state: ExpiryState; className?: string }) => (
  <Dotted variant={EXPIRY_VARIANT[state]} label={LABELS.expiry[state]} className={className} />
);
