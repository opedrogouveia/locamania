import { Global, Injectable, Module } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PdfTableColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfHeader {
  companyName: string;
  companyLine?: string | null;
  title: string;
  subtitle?: string | null;
}

const MARGIN = 48;
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const BRAND = '#1d4ed8';

/**
 * Construtor de PDFs (pdfkit): contrato, recibo e relatórios usam o mesmo
 * cabeçalho, tipografia e rodapé com paginação. Helvetica cobre os acentos do
 * português (WinAnsi); emoji não entra em PDF.
 */
export class PdfBuilder {
  readonly doc: PDFKit.PDFDocument;
  private readonly chunks: Buffer[] = [];
  private readonly done: Promise<Buffer>;

  constructor(options: { landscape?: boolean } = {}) {
    this.doc = new PDFDocument({
      size: 'A4',
      layout: options.landscape ? 'landscape' : 'portrait',
      margins: { top: MARGIN, bottom: MARGIN + 12, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Producer: 'Locamania', Creator: 'Locamania' },
    });
    this.done = new Promise((resolve) => {
      this.doc.on('data', (c: Buffer) => this.chunks.push(c));
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
    });
  }

  get width(): number {
    return this.doc.page.width - MARGIN * 2;
  }

  header(h: PdfHeader): this {
    const d = this.doc;
    d.fillColor(BRAND).font('Helvetica-Bold').fontSize(16).text(h.companyName, { continued: false });
    if (h.companyLine) d.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(h.companyLine);
    d.moveDown(0.8);
    d.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(h.title);
    if (h.subtitle) d.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(h.subtitle);
    d.moveDown(0.6);
    this.rule();
    return this;
  }

  rule(): this {
    const y = this.doc.y;
    this.doc.moveTo(MARGIN, y).lineTo(MARGIN + this.width, y).lineWidth(0.7).strokeColor(LINE).stroke();
    this.doc.moveDown(0.6);
    return this;
  }

  heading(text: string): this {
    this.ensureSpace(40);
    this.doc.moveDown(0.4).fillColor(INK).font('Helvetica-Bold').fontSize(11).text(text).moveDown(0.3);
    return this;
  }

  paragraph(text: string, opts: { size?: number; muted?: boolean; bold?: boolean } = {}): this {
    this.doc
      .fillColor(opts.muted ? MUTED : INK)
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opts.size ?? 10)
      .text(text, { align: 'justify', lineGap: 2 })
      .moveDown(0.5);
    return this;
  }

  /** Pares rótulo/valor em duas colunas. */
  keyValues(pairs: [string, string][], columns = 2): this {
    const colWidth = this.width / columns;
    for (let i = 0; i < pairs.length; i += columns) {
      this.ensureSpace(30);
      const y = this.doc.y;
      let maxY = y;
      pairs.slice(i, i + columns).forEach(([label, value], idx) => {
        const x = MARGIN + idx * colWidth;
        this.doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label.toUpperCase(), x, y, { width: colWidth - 10 });
        this.doc.fillColor(INK).font('Helvetica').fontSize(10).text(value || '—', x, this.doc.y + 1, { width: colWidth - 10 });
        maxY = Math.max(maxY, this.doc.y);
      });
      this.doc.x = MARGIN;
      this.doc.y = maxY + 6;
    }
    return this;
  }

  table(columns: PdfTableColumn[], rows: Record<string, string | number | null>[]): this {
    const total = columns.reduce((a, c) => a + c.width, 0);
    const scale = this.width / total;
    const cols = columns.map((c) => ({ ...c, w: c.width * scale }));
    const drawHeader = () => {
      const y = this.doc.y;
      let x = MARGIN;
      this.doc.rect(MARGIN, y - 2, this.width, 16).fill('#f3f4f6');
      for (const c of cols) {
        this.doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5)
          .text(c.label.toUpperCase(), x + 3, y + 2, { width: c.w - 6, align: c.align ?? 'left', lineBreak: false });
        x += c.w;
      }
      this.doc.y = y + 18;
    };
    drawHeader();
    for (const row of rows) {
      const heights = cols.map((c) =>
        this.doc.font('Helvetica').fontSize(8.5).heightOfString(String(row[c.key] ?? '—'), { width: c.w - 6 }),
      );
      const h = Math.max(...heights) + 6;
      if (this.doc.y + h > this.doc.page.height - MARGIN - 20) {
        this.doc.addPage();
        drawHeader();
      }
      const y = this.doc.y;
      let x = MARGIN;
      for (const c of cols) {
        this.doc.fillColor(INK).font('Helvetica').fontSize(8.5)
          .text(String(row[c.key] ?? '—'), x + 3, y + 3, { width: c.w - 6, align: c.align ?? 'left' });
        x += c.w;
      }
      this.doc.moveTo(MARGIN, y + h).lineTo(MARGIN + this.width, y + h).lineWidth(0.5).strokeColor(LINE).stroke();
      this.doc.x = MARGIN;
      this.doc.y = y + h + 1;
    }
    this.doc.moveDown(0.6);
    return this;
  }

  signatures(names: [string, string][]): this {
    this.ensureSpace(90);
    this.doc.moveDown(2.5);
    const colWidth = this.width / names.length;
    const y = this.doc.y;
    names.forEach(([role, name], i) => {
      const x = MARGIN + i * colWidth + 12;
      this.doc.moveTo(x, y).lineTo(x + colWidth - 24, y).lineWidth(0.7).strokeColor(INK).stroke();
      this.doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(name, x, y + 4, { width: colWidth - 24, align: 'center' });
      this.doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(role, x, this.doc.y, { width: colWidth - 24, align: 'center' });
    });
    this.doc.x = MARGIN;
    this.doc.moveDown(1);
    return this;
  }

  ensureSpace(height: number): void {
    if (this.doc.y + height > this.doc.page.height - MARGIN - 20) this.doc.addPage();
  }

  /** Rodapé em todas as páginas + fecha o documento. */
  async finish(footer: string): Promise<Buffer> {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      // Escrever abaixo da margem faria o pdfkit abrir uma página nova (página em branco no fim).
      this.doc.page.margins.bottom = 0;
      const bottom = this.doc.page.height - MARGIN + 10;
      this.doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
        .text(`${footer} · página ${i + 1} de ${range.count}`, MARGIN, bottom, {
          width: this.width,
          align: 'center',
          lineBreak: false,
        });
    }
    this.doc.end();
    return this.done;
  }
}

@Injectable()
export class PdfService {
  create(options: { landscape?: boolean } = {}): PdfBuilder {
    return new PdfBuilder(options);
  }
}

@Global()
@Module({ providers: [PdfService], exports: [PdfService] })
export class PdfModule {}
