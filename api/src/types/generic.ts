export type AllUnknown<T> = {
  [K in keyof T]: unknown;
};
