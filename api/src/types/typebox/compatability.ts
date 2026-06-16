import { Type } from '@sinclair/typebox';

/**
 * Type.Date() produces { type: 'object' } which fast-json-stringify 
 * can't serialize — string with date-time format works instead.
 */
export const Date = Type.Unsafe<Date>({ type: 'string', format: 'date-time' });
