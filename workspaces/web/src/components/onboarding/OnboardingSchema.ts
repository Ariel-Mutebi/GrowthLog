import z from 'zod';
import { PUBLIC_MAX_AVATAR_SIZE_BYTES } from 'astro:env/client';
import { ACCEPTED_TYPES, type ACCEPTED_TYPE } from '../acceptedMime.ts';

const MB = PUBLIC_MAX_AVATAR_SIZE_BYTES / 1024 ** 2;

export const OnboardingSchema = z.object({
  avatar: z
    .instanceof(File, { error: 'Please chose a profile picture' })
    .refine(
      (file) => file.size <= PUBLIC_MAX_AVATAR_SIZE_BYTES,
      `Please upload an image under ${MB} MB`,
    )
    .refine(
      (file) => ACCEPTED_TYPES.includes(file.type as ACCEPTED_TYPE),
      'Please use a JPG, PNG, or WebP image',
    )
    .optional(),

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
