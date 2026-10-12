export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ACCEPTED_TYPE = typeof ACCEPTED_TYPES[number];
