import { describeAudit } from './audit-describer';

describe('describeAudit (histórico em linguagem natural)', () => {
  it('rotula campos em português e esconde ids técnicos', () => {
    const d = describeAudit(
      { action: 'STATUS_CHANGE', entityType: 'Motorcycle', actorName: 'Marina', changes: { data: { status: 'MAINTENANCE', statusReason: 'Revisão', registeredById: 'u1' } } },
      'ABC1D23',
    );
    expect(d.summary).toBe('Marina mudou a situação de moto ABC1D23 para "Em manutenção".');
    expect(d.changedFields.map((f) => f.label)).toEqual(['situação', 'motivo da situação']);
  });

  it('registro antigo com `data` omitido não vira campos letra a letra', () => {
    const d = describeAudit({ action: 'UPDATE', entityType: 'Contract', actorName: 'Marina', changes: { data: '[omitido]' } }, 'LOC-2026-0001');
    expect(d.changedFields).toEqual([]);
    expect(d.summary).toBe('Marina alterou dados de contrato LOC-2026-0001.');
  });

  it('situação da ocorrência sai com o rótulo', () => {
    const d = describeAudit({ action: 'STATUS_CHANGE', entityType: 'Occurrence', actorName: 'Diego', changes: { data: { status: 'RESOLVED' } } }, 'da moto ABC1D23');
    expect(d.summary).toBe('Diego mudou a situação de ocorrência da moto ABC1D23 para "Resolvida".');
  });
});
