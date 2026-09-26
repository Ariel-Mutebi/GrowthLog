import type { Type, TUnion, TNull, TSchema } from '@sinclair/typebox';

type BaseTypeBoxSchema<T> =
  [T] extends [string] ? ReturnType<typeof Type.String> :
  [T] extends [number] ? ReturnType<typeof Type.Number> :
  [T] extends [boolean] ? ReturnType<typeof Type.Boolean> :
  [T] extends [Date] ? ReturnType<typeof Type.Date> :
  TSchema;

type TypeBoxSchema<T> = [T] extends [null]
  ? ReturnType<typeof Type.Null>
  : null extends T
  ? TUnion<[BaseTypeBoxSchema<Exclude<T, null>>, TNull]>
  : BaseTypeBoxSchema<T>;

export type TypeBoxModel<T> = {
  [K in keyof T]: TypeBoxSchema<T[K]>;
};
