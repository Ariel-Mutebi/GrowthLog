import 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    adminUrl: string;
    redisUrl: string;
  }
}
