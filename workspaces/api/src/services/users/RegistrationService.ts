import { hash } from 'bcrypt';
import slugify from 'slugify';
import { randomInt } from 'node:crypto';
import { flattenAvatarKey, assertStrongPassword } from './shared/helpers.js';
import { HASHING_ROUNDS } from './shared/constants.js';
import { personalSelect } from './shared/selectors.js';
import { conflictsOn } from '../../utils/extractors.js';

import {
  PrismaClientKnownRequestError,
  type PrismaClient,
} from '@growthlog/db';
import type { Editable, Personal } from './shared/interfaces.js';
import { EmailConflictError, UsernameConflictError } from './shared/errors.js';

export class RegistrationService {
  constructor(private readonly prisma: PrismaClient) {}

  public async register(fields: Editable): Promise<Personal> {
    const { password, ...rest } = fields;

    assertStrongPassword(password);
    const hashedPassword = await hash(password, HASHING_ROUNDS);

    return this.createUser({ ...rest, password: hashedPassword });
  }

  private async createUser(fields: Editable): Promise<Personal>  {
    const { username, forename, surname, bio, email, password } = fields;

    try {
      const user = await this.prisma.user.create({
        data: {
          forename,
          surname,
          password,
          email: email.toLocaleLowerCase(),
          username:
            username ||
            `${slugify(`${forename} ${surname}`, { lower: true, strict: true })}-${randomInt(1000, 10000)}`,
          ...(bio ? { bio } : {}),
        },
        select: personalSelect,
      });

      return flattenAvatarKey(user);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        if (conflictsOn(error.meta, 'username')) {
          if (username) {
            throw new UsernameConflictError();
          }
          return this.createUser(fields);
        }
        throw new EmailConflictError();
      }
      throw error;
    }
  }
}
