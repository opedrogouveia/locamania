import { Inject, Injectable } from '@nestjs/common';
import { resolveCustomerStatus, type CustomerStatus } from '@locamania/shared';

import { ParametersService } from '../../../shared/parameters/parameters.service';
import { ClockService } from '../../../shared/time/clock.service';
import { CUSTOMERS_REPOSITORY, type CustomersRepository } from '../domain/customers.ports';

/**
 * Recalcula a situação efetiva do cliente (Ativo / Em atraso / Contrato
 * encerrado / Bloqueado / Inativo) a partir dos fatos. Chamado por quem muda
 * esses fatos — pagamento registrado, contrato entregue/encerrado, job diário
 * de atraso — para a lista de clientes filtrar certo.
 */
@Injectable()
export class CustomerStatusService {
  constructor(
    @Inject(CUSTOMERS_REPOSITORY) private readonly repo: CustomersRepository,
    private readonly params: ParametersService,
    private readonly clock: ClockService,
  ) {}

  async recompute(customerId: string): Promise<CustomerStatus | null> {
    const customer = await this.repo.findById(customerId);
    if (!customer) return null;
    const rules = await this.params.chargeRules();
    const facts = await this.repo.statusFacts(customerId, this.clock.today(), rules.graceDays);
    const status = resolveCustomerStatus({ manualStatus: customer.manualStatus, ...facts });
    if (status !== customer.status) await this.repo.setStatus(customerId, status);
    return status;
  }

  async recomputeMany(ids: string[]): Promise<number> {
    let changed = 0;
    for (const id of new Set(ids)) {
      const before = (await this.repo.findById(id))?.status;
      const after = await this.recompute(id);
      if (after && after !== before) changed += 1;
    }
    return changed;
  }
}

