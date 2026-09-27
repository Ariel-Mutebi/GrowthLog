import { Type } from '@sinclair/typebox';

export const SerializableDate = Type.Unsafe<Date>({ type: 'string', format: 'date-time' });
