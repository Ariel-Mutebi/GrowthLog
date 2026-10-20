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

export type User = SuccessResponse<'/api/me'>;
export type Drafts = SuccessResponse<'/api/me/drafts'>;
export type Prepublish = SuccessResponse<'/api/me/drafts/{id}/publish'>;
export type TagSuggestions = SuccessResponse<'/api/tags'>;
