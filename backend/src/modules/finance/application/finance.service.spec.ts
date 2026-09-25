import { bucketOf } from './finance.service';

describe('série do financeiro', () => {
  it('dia até 31 dias, semana até 4 meses, mês acima', () => {
    expect(bucketOf('2026-10-15', 30)).toEqual({ key: '2026-10-15', label: '15/10' });
    expect(bucketOf('2026-10-15', 90).key).toBe('2026-10-12'); // segunda-feira
    expect(bucketOf('2026-10-15', 365)).toEqual({ key: '2026-10-01', label: 'out/26' });
  });
});
