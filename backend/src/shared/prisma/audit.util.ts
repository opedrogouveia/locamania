/**
 * Utilitários de auditoria compartilhados pela extensão do Prisma (escrita
 * automática) e pelo AuditService (eventos explícitos).
 */

/** Campos que nunca podem aparecer em `changes` (segredos). */
export const SECRET_KEYS = new Set([
  'passwordHash',
  'password',
  'token',
  'tokenHash',
  'accessToken',
  'secret',
]);

/** Campos grandes demais para o log (bytes de arquivo, texto do contrato). */
export const BULKY_KEYS = new Set(['data', 'renderedText', 'contractTemplate', 'payload']);

/**
 * Serializa com segurança (Decimal → string, Date → ISO, Buffer → marcador).
 * Sem isso, escrita com Decimal quebrava a auditoria e o erro era engolido —
 * bug real do SafeKeep.
 */
export function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value ?? null, (_key, val: unknown) => {
      if (val && typeof val === 'object' && (val as { type?: string }).type === 'Buffer') return '[arquivo]';
      if (typeof val === 'bigint') return val.toString();
      return val;
    }),
  );
}

/** Remove segredos e encurta campos volumosos, recursivamente. */
export function maskSecrets(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key)) out[key] = '[REDACTED]';
      else if (BULKY_KEYS.has(key)) out[key] = '[omitido]';
      else out[key] = maskSecrets(val);
    }
    return out;
  }
  return value;
}

export const WRITE_OPERATION_TO_ACTION: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
  create: 'CREATE',
  createMany: 'CREATE',
  createManyAndReturn: 'CREATE',
  update: 'UPDATE',
  updateMany: 'UPDATE',
  upsert: 'UPDATE',
  delete: 'DELETE',
  deleteMany: 'DELETE',
};

/**
 * Models que não entram na auditoria automática: o próprio log, filas técnicas
 * e o que tem volume alto sem valor de histórico (uma notificação por cliente
 * por lembrete encheria a tela de histórico de ruído).
 */
export const UNAUDITED_MODELS = new Set([
  'AuditLog',
  'Notification',
  'NotificationDelivery',
  'JobRun',
  'TrackerPosition',
  'AuthToken',
  'GatewayEvent',
]);

export function extractEntityId(result: unknown, args: unknown): string | undefined {
  if (result && typeof result === 'object' && 'id' in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  if (result && typeof result === 'object' && 'key' in result) {
    const key = (result as { key: unknown }).key;
    if (typeof key === 'string') return key;
  }
  if (args && typeof args === 'object' && 'where' in args) {
    const where = (args as { where?: { id?: unknown } }).where;
    if (where && typeof where.id === 'string') return where.id;
  }
  return undefined;
}

export function buildChanges(operation: string, args: unknown, result: unknown): Record<string, unknown> {
  const a = (args ?? {}) as Record<string, unknown>;
  let raw: Record<string, unknown>;
  switch (operation) {
    case 'create':
    case 'createMany':
    case 'createManyAndReturn':
      raw = { after: result ?? a.data };
      break;
    case 'update':
    case 'updateMany':
      raw = { where: a.where, data: a.data };
      break;
    case 'upsert':
      raw = { where: a.where, create: a.create, update: a.update };
      break;
    case 'delete':
    case 'deleteMany':
      raw = { where: a.where };
      break;
    default:
      raw = {};
  }
  return maskSecrets(jsonSafe(raw)) as Record<string, unknown>;
}
