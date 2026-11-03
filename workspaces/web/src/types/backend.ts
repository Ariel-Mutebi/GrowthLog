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

export type User = SuccessResponse<'/me'>;
export type Drafts = SuccessResponse<'/me/drafts'>;
export type Prepublish = SuccessResponse<'/me/drafts/{id}/publish'>;
export type TagSuggestions = SuccessResponse<'/tags'>;
export type Feed = SuccessResponse<'/posts'>;
