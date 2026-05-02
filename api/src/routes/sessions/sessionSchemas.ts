import { Type } from '@sinclair/typebox';
import { Email } from '../../types/customTypebox.js';

export const PostSessionBody = Type.Object({
  email: Email,
  password: Type.String(),
});
