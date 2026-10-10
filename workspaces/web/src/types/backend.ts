import type { paths } from '@growthlog/api';

export type User = paths['/api/users']['get']['responses']['200']['content']['application/json'];
export type Drafts = paths['/api/posts']['get']['responses']['200']['content']['application/json'];
