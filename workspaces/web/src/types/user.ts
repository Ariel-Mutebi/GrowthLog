import type { paths } from '@growthlog/api';

export type User = paths['/api/users']['get']['responses']['200']['content']['application/json'];
