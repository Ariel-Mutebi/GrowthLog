import type { paths } from '@growthlog/api';

type SuccessResponse<T extends keyof paths> =
  paths[T] extends {
    get: {
      responses: {
        200: {
          content: {
            'application/json': infer R;
          };
        };
      };
    };
  }
  ? R
  : never;

export type User = SuccessResponse<'/api/users'>;
export type Drafts = SuccessResponse<'/api/posts'>;
export type Prepublish = SuccessResponse<'/api/posts/{slug}/prepublish'>;
