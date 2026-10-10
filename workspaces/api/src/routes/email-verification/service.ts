import { randomInt, createHash } from 'node:crypto';
import type { PrismaClient } from '@growthlog/db';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export class InvalidCode extends Error { };

export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  /** Random six-digit code */
  generateCode () {
    return randomInt(100000, 1000000).toString();
  }

  private hashCode(code: string) {
    // sha256 because its fast and verification codes are short-lived and low-risk
    return createHash('sha256').update(code).digest('hex');
  }

  async issueCode(userId: string, code: string) {
    await this.prisma.emailVerificationCode.deleteMany({ where: { userId } });

    await this.prisma.emailVerificationCode.create({
      data: {
        userId,
        hash: this.hashCode(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
  }

  private async getCodeId(userId: string, code: string) {
    try {
      const { id } = await this.prisma.emailVerificationCode.findFirstOrThrow({
        where: {
          userId,
          hash: this.hashCode(code),
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      return id;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new InvalidCode();
      }
      throw error;
    }
  }

  async verifyEmail(userId: string, code: string) {
    const codeId = await this.getCodeId(userId, code);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationCode.delete({
        where: {
          id: codeId,
        },
      }),
    ]);
  }
}
