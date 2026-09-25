# Template — módulo novo (backend + frontend)

> Fiel ao código real (no SafeKeep o template divergia e quem o seguia escrevia diferente do resto).
> Referência viva: `backend/src/modules/customers/`. Troque `Thing`/`thing`/`things`.

## 1. Shared (`packages/shared/src/`)

- `contracts/<arquivo>.ts`: `ThingDto`, `CreateThingRequest`, `UpdateThingRequest = Partial<…>`,
  `ListThingsQuery extends PaginationQuery`.
- Enum novo em `enums/index.ts` + rótulos em `labels.ts`.
- Regra pura (se houver) em `rules/` **com teste** em `rules/*.spec.ts`.
- `pnpm --filter @locamania/shared build` (back e front consomem o `dist`).

## 2. Backend (`backend/src/modules/things/`)

```ts
// domain/things.ports.ts
export const THINGS_REPOSITORY = Symbol('ThingsRepository');

export interface ThingRecord { id: string; name: string; /* … */ createdAt: Date; updatedAt: Date }
export interface CreateThingData { name: string }
export type UpdateThingData = Partial<CreateThingData>;

export interface ThingsRepository {
  create(data: CreateThingData): Promise<ThingRecord>;
  update(id: string, data: UpdateThingData): Promise<ThingRecord>;
  findById(id: string): Promise<ThingRecord | null>;
  list(params: { skip: number; take: number; search?: string }): Promise<{ items: ThingRecord[]; total: number }>;
  archive(id: string): Promise<void>;
}
```

```ts
// application/things.service.ts
@Injectable()
export class ThingsService {
  constructor(@Inject(THINGS_REPOSITORY) private readonly repo: ThingsRepository) {}

  async list(query: ListThingsQuery, actor: StaffPrincipal): Promise<PaginatedResponse<ThingDto>> {
    const p = pageParams(query);
    const { items, total } = await this.repo.list({ skip: p.skip, take: p.take, search: searchTerm(query.search) });
    return paginated(items.map((r) => toThingDto(r, actor)), total, p);
  }

  async get(id: string, actor: StaffPrincipal): Promise<ThingDto> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Registro não encontrado.');
    return toThingDto(record, actor);
  }
  // create/update/archive: regra pura → repo → DTO
}
```

```ts
// application/things.mapper.ts — decide o que ocultar pelo Principal
export function toThingDto(r: ThingRecord, actor: StaffPrincipal): ThingDto {
  return { id: r.id, name: r.name, amount: moneyFor(actor, Permission.PAYMENTS_VIEW, money(r.amount)), createdAt: iso(r.createdAt) };
}
```

```ts
// infrastructure/prisma-things.repository.ts — filtra deletedAt explicitamente; list + count num $transaction
@Injectable()
export class PrismaThingsRepository implements ThingsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list({ skip, take, search }) {
    const where: Prisma.ThingWhereInput = { deletedAt: null, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.thing.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.client.thing.count({ where }),
    ]);
    return { items, total };
  }
  async archive(id: string) {
    await this.prisma.client.thing.update({ where: { id }, data: { deletedAt: new Date() } }); // auditado como DELETE
  }
}
```

```ts
// presentation/things.controller.ts — fino; permissão em TODA rota
@ApiTags('things') @ApiBearerAuth() @Controller('things')
export class ThingsController {
  constructor(private readonly things: ThingsService) {}
  @Get() @RequirePermissions(Permission.THINGS_VIEW)
  list(@Query() q: ListThingsQueryDto, @CurrentStaff() actor: StaffPrincipal) { return this.things.list(q, actor); }
}
```

- DTO HTTP (`presentation/http/things.dto.ts`): `class CreateThingDto implements CreateThingRequest`
  com `class-validator` (**mensagens em pt-BR**) + `@ApiProperty`.
- `things.module.ts`: `providers: [ThingsService, { provide: THINGS_REPOSITORY, useClass: PrismaThingsRepository }]`.
- Registrar em `src/modules/index.ts`.
- Permissão nova? `packages/shared/src/permissions.ts` (catálogo + padrão por papel).

## 3. Frontend

- `lib/api/things.ts`: `thingsApi = { list: (q) => api.get<PaginatedResponse<ThingDto>>(`/things${qs(q)}`), … }`.
- `lib/things/queries.ts`: `useThings(q)`, `useThing(id)`, `useCreateThing()` (invalida `['things']`).
- `lib/things/meta.ts`: variante do Badge por status (rótulo vem do shared).
- Telas em `app/admin/things/` seguindo [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) §4; menu em
  `components/layout/admin-nav.ts` com a permissão.

## 4. Checklist

- [ ] Contrato no shared; regra pura com teste.
- [ ] Porta → repositório → serviço → mapper → DTO → controller → módulo → `modules/index.ts`.
- [ ] `@RequirePermissions` em toda rota; valores ocultos sem permissão.
- [ ] Arquivar (deletedAt), nunca apagar; leitura filtra `deletedAt: null`.
- [ ] Tela com loading/vazio/erro, `useCan`, 390 px e 1440 px.
- [ ] `pnpm typecheck` e `pnpm test`; checkbox no `PLANO_MVP.md`; commit por bloco.
