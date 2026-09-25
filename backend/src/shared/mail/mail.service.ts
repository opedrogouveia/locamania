import { Global, Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../prisma/prisma.service';

export interface MailMessage {
  to: string;
  subject: string;
  /** Título grande no corpo. */
  title: string;
  greeting?: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

/**
 * Envio de e-mail com um layout só (Handlebars): cabeçalho com a marca, corpo
 * em parágrafos, botão opcional e rodapé com os dados da empresa.
 *
 * Dev: Mailpit (http://localhost:8026) captura tudo. Sem MAIL_HOST, a API sobe
 * e só registra no log. **Falha de envio nunca quebra a operação**: e-mail é
 * notificação, não parte da transação — o pagamento já foi gravado.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;
  private template?: HandlebarsTemplateDelegate;
  private company?: { value: Record<string, unknown>; at: number };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get configured(): boolean {
    return !!this.transporter;
  }

  onModuleInit(): void {
    const host = this.config.get<string>('MAIL_HOST');
    if (!host) {
      this.logger.warn('MAIL_HOST não configurado — e-mails serão apenas registrados no log.');
      return;
    }
    const user = this.config.get<string>('MAIL_USER');
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('MAIL_PORT') ?? 1025),
      secure: this.config.get<string>('MAIL_SECURE') === 'true',
      ...(user ? { auth: { user, pass: this.config.get<string>('MAIL_PASSWORD') ?? '' } } : {}),
    });
  }

  /** Lê o .hbs do dist (produção) ou do fonte (dev). */
  private readTemplate(name: string): string {
    const file = path.join(__dirname, 'templates', `${name}.hbs`);
    return fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8')
      : fs.readFileSync(path.join(process.cwd(), 'src/shared/mail/templates', `${name}.hbs`), 'utf8');
  }

  private async companyContext(): Promise<Record<string, unknown>> {
    if (this.company && Date.now() - this.company.at < 60_000) return this.company.value;
    try {
      const c = await this.prisma.raw.companySettings.findUnique({ where: { id: 'company' } });
      const value: Record<string, unknown> = c
        ? { name: c.tradeName, phone: c.phone, whatsapp: c.whatsapp, email: c.email, city: c.city, state: c.state }
        : { name: 'Locamania' };
      this.company = { value, at: Date.now() };
      return value;
    } catch {
      return { name: 'Locamania' };
    }
  }

  async render(message: Omit<MailMessage, 'to' | 'subject' | 'attachments'>): Promise<string> {
    this.template ??= Handlebars.compile(this.readTemplate('message'));
    return this.template({ ...message, company: await this.companyContext(), year: new Date().getFullYear() });
  }

  async send(message: MailMessage): Promise<{ sent: boolean; detail: string }> {
    try {
      const html = await this.render(message);
      if (!this.transporter) {
        this.logger.log(`[e-mail não enviado: sem SMTP] ${message.to}: ${message.subject}`);
        return { sent: false, detail: 'E-mail não configurado' };
      }
      await this.transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM') ?? 'Locamania <no-reply@locamania.com.br>',
        to: message.to,
        subject: message.subject,
        html,
        attachments: message.attachments,
      });
      return { sent: true, detail: message.to };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao enviar e-mail para ${message.to}: ${detail}`);
      return { sent: false, detail };
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
