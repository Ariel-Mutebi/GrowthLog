import 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    adminUrl: string;
    minio: {
      endpoint: string;
      user: string;
      password: string;
    };
  }
}
