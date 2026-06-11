import type { User } from '../db/client.js';
import type { Role } from '../db/enums.js';

export type AllUnknown<T> = {
  [K in keyof T]: unknown;
};

export type NonModeratorUser = Omit<User, 'role'> & {
  role: Exclude<Role, 'MODERATOR'>;
};
