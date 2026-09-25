/**
 * Payload "PIX copia e cola" (BR Code, padrão EMV® MPM do Banco Central).
 * Usado pelo gateway sandbox para o QR ter o formato real — o app do banco lê
 * e mostra os dados. Em produção quem gera é o gateway (com o txid dele).
 */

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function ascii(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .slice(0, max)
    .trim();
}

export function buildPixBrCode(input: { key: string; merchantName: string; merchantCity: string; amount: string; txid: string; description?: string }): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', input.key) + (input.description ? field('02', ascii(input.description, 40)) : '');
  const payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    field('54', Number(input.amount).toFixed(2)) +
    field('58', 'BR') +
    field('59', ascii(input.merchantName, 25) || 'LOCAMANIA') +
    field('60', ascii(input.merchantCity, 15) || 'SAO PAULO') +
    field('62', field('05', input.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***')) +
    '6304';
  return payload + crc16(payload);
}
