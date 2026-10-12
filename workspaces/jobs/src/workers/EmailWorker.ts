import { GrowthLogWorker } from './GrowthLogWorker.js';
import nodmailer, { type Transporter } from 'nodemailer';

import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import type { PrismaClient } from '@growthlog/db';
import type { SMTPCredentials, VerificationEmailJobData } from '../types.js';

export class EmailWorker extends GrowthLogWorker {
  private readonly from: string;
  private readonly transporter: Transporter;

  constructor(
    redis: RedisClientType,
    log: Logger,
    prisma: PrismaClient,
    credentials: SMTPCredentials,
  ) {
    super('email', redis, log, prisma);
    this.from = credentials.from;

    this.transporter = nodmailer.createTransport({
      secure: true,
      host: credentials.host,
      port: credentials.port,
      auth: {
        user: credentials.user,
        pass: credentials.pass,
      },
    });

    this.registry.set(
      'send-verification-email',
      (data) => this.sendVerificationEmail(data as VerificationEmailJobData),
    );
  }

  public async check() {
    try {
      await this.transporter.verify();
      this.log.info('SMTP server ready');
    } catch (error) {
      this.log.error(error, 'transporter verification failed');
    }
  }

  async close() {
    await this.transporter.close();
    await this.close();
  }

  private async sendVerificationEmail({ userId, code }: VerificationEmailJobData) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        forename: true,
        email: true,
      },
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: user.email,
        subject: 'Verify your email',
        text: `Your GrowthLog verification code is ${code}. It expires in ten minutes`,
      });
    } catch (error) {
      this.log.error(error, 'sendMail error');
      throw error;
    }
  }
}
