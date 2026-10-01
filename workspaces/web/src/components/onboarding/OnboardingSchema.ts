import z from 'zod';

const MAX_AVATAR_BYTES = Number(import.meta.env.PUBLIC_MAX_AVATAR_SIZE_BYTES);
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ACCEPTED_TYPE = typeof ACCEPTED_TYPES[number];

export const OnboardingSchema = z.object({
  avatar: z
    .instanceof(File, { error: 'Please chose a profile picture' })
    .refine(
      (file) => file.size <= MAX_AVATAR_BYTES,
      `Please upload an image under ${MAX_AVATAR_BYTES / 1024 ** 2} MB`,
    )
    .refine(
      (file) => ACCEPTED_TYPES.includes(file.type as ACCEPTED_TYPE),
      'Please use a JPG, PNG, or WebP image',
    ),

  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-z0-9._-]+$/, 'Use only lowercase letters, numbers, hyphens, periods and underscores.')
    .regex(/^[a-z0-9]/, 'Start with a letter or number.')
    .regex(/[a-z0-9]$/, 'End with a letter or number.')
    .regex(/^(?!.*[-._]{2})/, 'Don\'t use two symbols in a row.'),

  bio: z
    .string()
    .trim()
    .min(2, 'Bio must be at least 2 characters')
    .max(200, 'Bio must be at most 20 characters'),
});

export type OnboardingData = z.infer<typeof OnboardingSchema>;
