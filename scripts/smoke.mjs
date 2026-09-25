#!/usr/bin/env node
/**
 * Teste de fumaça da API — confere o essencial depois de subir ou de um deploy.
 *
 *   node scripts/smoke.mjs                       # só leitura (seguro em produção)
 *   node scripts/smoke.mjs --write               # + fluxo completo de aluguel (cria dados!)
 *   API=https://locamania-api.onrender.com PASSWORD=... node scripts/smoke.mjs
 *
 * Contas: as da demonstração (docs/README). Em produção, informe as suas por
 * OWNER_EMAIL / STAFF_EMAIL / CUSTOMER_CPF (as que não existirem são puladas).
 */
const API = (process.env.API ?? 'http://localhost:3201').replace(/\/$/, '');
const PASSWORD = process.env.PASSWORD ?? 'changeme123';
const WRITE = process.argv.includes('--write');
const ACCOUNTS = {
  owner: process.env.OWNER_EMAIL ?? 'proprietaria@locamania.local',
  admin: process.env.ADMIN_EMAIL ?? 'admin@locamania.local',
  finance: process.env.FINANCE_EMAIL ?? 'financeiro@locamania.local',
  staff: process.env.STAFF_EMAIL ?? 'funcionario@locamania.local',
  customer: process.env.CUSTOMER_CPF ?? '52998224725',
};

let failures = 0;
let passes = 0;
const ok = (msg) => {
  passes++;
  console.log(`  ✓ ${msg}`);
};
const fail = (msg, detail) => {
  failures++;
  console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`);
};
const section = (t) => console.log(`\n${t}`);

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function expectStatus(label, method, path, expected, opts) {
  const r = await call(method, path, opts);
  const list = Array.isArray(expected) ? expected : [expected];
  if (list.includes(r.status)) ok(`${label} (${r.status})`);
  else fail(label, `esperado ${list.join('/')}, veio ${r.status} ${JSON.stringify(r.json)?.slice(0, 160)}`);
  return r;
}

async function login(identifier) {
  const r = await call('POST', '/auth/login', { body: { identifier, password: PASSWORD } });
  return r.status === 200 ? r.json.accessToken : null;
}

function validCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (new Set(n).size === 1) n[0] = (n[0] + 1) % 10;
  const dv = (arr) => {
    const s = arr.reduce((acc, d, i) => acc + d * (arr.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join('');
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const addDays = (ymd, d) => {
  const t = new Date(`${ymd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

async function main() {
  console.log(`Locamania — teste de fumaça em ${API}${WRITE ? ' (com escrita)' : ''}`);

  section('Saúde');
  await expectStatus('API no ar', 'GET', '/health', 200);

  section('Login de cada perfil');
  const tokens = {};
  for (const [role, id] of Object.entries(ACCOUNTS)) {
    tokens[role] = await login(id);
    if (tokens[role]) ok(`${role} entra (${id})`);
    else console.log(`  - ${role} (${id}): conta não existe ou senha diferente — pulando`);
  }
  await expectStatus('senha errada é recusada', 'POST', '/auth/login', 401, { body: { identifier: ACCOUNTS.owner, password: 'errada-123456' } });

  section('Permissões');
  if (tokens.owner) {
    await expectStatus('proprietária vê o painel', 'GET', '/dashboard', 200, { token: tokens.owner });
    await expectStatus('proprietária gerencia usuários', 'GET', '/users', 200, { token: tokens.owner });
  }
  if (tokens.admin) await expectStatus('administrador NÃO gerencia usuários', 'GET', '/users', 403, { token: tokens.admin });
  if (tokens.finance) await expectStatus('financeiro NÃO mexe em configurações', 'PATCH', '/settings/company', 403, { token: tokens.finance, body: { supportHours: 'x' } });
  if (tokens.staff) {
    await expectStatus('funcionário NÃO vê cobranças', 'GET', '/charges', 403, { token: tokens.staff });
    const r = await call('GET', '/customers?pageSize=5', { token: tokens.staff });
    if (r.status === 200 && r.json.data.every((c) => c.overdueAmount === null)) ok('funcionário vê clientes, sem valores em dinheiro');
    else fail('funcionário vê clientes sem valores', `status ${r.status}`);
  }
  await expectStatus('sem login não entra', 'GET', '/customers', 401);
  await expectStatus('rotina diária sem segredo é recusada', 'POST', '/jobs/run', 401);

  section('App do cliente e isolamento');
  if (tokens.customer) {
    await expectStatus('cliente vê o início do app', 'GET', '/portal/home', 200, { token: tokens.customer });
    await expectStatus('cliente vê os próprios pagamentos', 'GET', '/portal/charges', 200, { token: tokens.customer });
    await expectStatus('cliente NÃO acessa o painel', 'GET', '/customers', 403, { token: tokens.customer });
    await expectStatus('cliente NÃO acessa cobranças da equipe', 'GET', '/charges', 403, { token: tokens.customer });
    if (tokens.owner) {
      await expectStatus('equipe NÃO usa rotas do app do cliente', 'GET', '/portal/home', 403, { token: tokens.owner });
      const other = await call('GET', '/charges?status=OVERDUE&pageSize=20', { token: tokens.owner });
      const mine = await call('GET', '/portal/charges', { token: tokens.customer });
      const mineIds = new Set([...(mine.json?.open ?? []), ...(mine.json?.history ?? []), ...(Array.isArray(mine.json) ? mine.json : [])].map((c) => c.id));
      const foreign = other.json?.data?.find((c) => !mineIds.has(c.id));
      if (foreign) {
        await expectStatus('cliente NÃO abre cobrança de outro cliente', 'GET', `/portal/charges/${foreign.id}`, [403, 404], { token: tokens.customer });
        await expectStatus('cliente NÃO gera PIX de cobrança de outro', 'POST', `/portal/charges/${foreign.id}/pix`, [403, 404], { token: tokens.customer });
      }
    }
  }

  if (WRITE && tokens.owner) {
    section('Fluxo completo de aluguel (cria dados)');
    const t = tokens.owner;
    const cust = await expectStatus('cadastra cliente', 'POST', '/customers', 201, {
      token: t,
      body: {
        name: `Teste Fumaça ${Date.now().toString().slice(-5)}`,
        cpf: validCpf(),
        phone: '11987654321',
        cnhNumber: '12345678901',
        cnhCategory: 'A',
        cnhExpiresAt: addDays(today(), 800),
      },
    });
    const motos = await call('GET', '/motorcycles?status=AVAILABLE&pageSize=1', { token: t });
    const moto = motos.json?.data?.[0];
    if (!cust.json?.id || !moto) {
      fail('fluxo interrompido', !moto ? 'nenhuma moto disponível' : 'cliente não criado');
    } else {
      const start = today();
      const contract = await expectStatus('cria contrato (moto reservada)', 'POST', '/contracts', 201, {
        token: t,
        body: { customerId: cust.json.id, motorcycleId: moto.id, startDate: start, endDate: addDays(start, 60), periodicity: 'WEEKLY', rentAmount: '350.00', depositAmount: '500.00' },
      });
      const id = contract.json?.id;
      if (id) {
        await expectStatus('entrega sem assinatura é bloqueada', 'POST', `/contracts/${id}/deliver`, [400, 409, 422], { token: t, body: { initialKm: moto.currentKm } });
        await expectStatus('registra assinatura presencial', 'POST', `/contracts/${id}/signature`, 201, { token: t, body: { method: 'IN_PERSON' } });
        await expectStatus('entrega a moto (gera cronograma e caução)', 'POST', `/contracts/${id}/deliver`, 201, { token: t, body: { initialKm: moto.currentKm } });
        const charges = await call('GET', `/charges?contractId=${id}&pageSize=50`, { token: t });
        const open = (charges.json?.data ?? []).filter((c) => c.status !== 'PAID');
        if (open.length >= 2) ok(`${open.length} cobranças geradas`);
        else fail('cobranças geradas', `${open.length}`);
        if (open[0]) await expectStatus('dá baixa em dinheiro', 'POST', `/charges/${open[0].id}/pay`, 201, { token: t, body: { paidAt: start, paidAmount: open[0].amount, method: 'CASH' } });
        if (open[1]) {
          const pix = await expectStatus('PIX de teste confirmado por webhook', 'POST', `/charges/${open[1].id}/pix/simulate`, [200, 201], { token: t });
          if (pix.json?.status === 'PAID') ok('cobrança ficou paga pelo gateway');
          else fail('cobrança paga pelo gateway', pix.json?.status);
        }
        await expectStatus('devolve a moto e encerra o contrato', 'POST', `/contracts/${id}/return`, 201, {
          token: t,
          body: { returnedAt: start, finalKm: moto.currentKm + 120, condition: 'GOOD', nextMotorcycleStatus: 'AVAILABLE', depositOutcome: 'REFUNDED' },
        });
        const hist = await call('GET', `/audit/timeline/Contract/${id}`, { token: t });
        if ((hist.json?.total ?? 0) >= 4) ok(`histórico registrou ${hist.json.total} eventos do contrato`);
        else fail('histórico do contrato', `${hist.json?.total}`);
      }
      // Limpeza: o cliente de teste sai das listas (fica só no histórico).
      await expectStatus('arquiva o cliente de teste', 'DELETE', `/customers/${cust.json.id}`, [200, 204], { token: t });
    }
  }

  console.log(`\n${passes} ok, ${failures} falha(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro inesperado:', e);
  process.exit(1);
});
