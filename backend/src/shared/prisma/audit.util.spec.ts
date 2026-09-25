import { buildChanges } from './audit.util';

describe('buildChanges (auditoria automática)', () => {
  it('update guarda os campos alterados — `data` do Prisma não é tratado como arquivo', () => {
    const changes = buildChanges('update', { where: { id: 'm1' }, data: { status: 'MAINTENANCE', currentKm: 1200 } }, { id: 'm1' });
    expect(changes).toEqual({ where: { id: 'm1' }, data: { status: 'MAINTENANCE', currentKm: 1200 } });
  });

  it('bytes do documento continuam fora do log', () => {
    const changes = buildChanges('create', { data: {} }, { id: 'd1', title: 'CRLV', data: Buffer.from('pdf') });
    expect(changes).toEqual({ after: { id: 'd1', title: 'CRLV', data: '[omitido]' } });
  });

  it('segredos nunca aparecem', () => {
    const changes = buildChanges('update', { where: { id: 'u1' }, data: { passwordHash: 'x', name: 'Ana' } }, { id: 'u1' });
    expect(changes).toEqual({ where: { id: 'u1' }, data: { passwordHash: '[REDACTED]', name: 'Ana' } });
  });
});
