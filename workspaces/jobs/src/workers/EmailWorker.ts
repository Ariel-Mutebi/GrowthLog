import { GrowthLogWorker } from './GrowthLogWorker.js';
import nodemailer, { type Transporter } from 'nodemailer';

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

    this.transporter = nodemailer.createTransport({
      secure: credentials.secure,
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

  override async close(force?: boolean) {
    await super.close(force);
    this.transporter.close();
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

    await this.transporter.sendMail({
      from: this.from,
      to: user.email,
      subject: 'Verify your email',
      text: `Hello, ${user.forename}! Your GrowthLog verification code is ${code}. It expires in ten minutes`,
    });
  }
}
