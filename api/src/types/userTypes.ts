import type { Role } from '../db/enums.js';

export interface SerializedUser {
  id: string;
  role: Role;
}
