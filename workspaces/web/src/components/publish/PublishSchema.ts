import z from 'zod';
import { PUBLIC_MAX_IMAGE_SIZE_BYTES } from 'astro:env/client';
import { ACCEPTED_TYPES, type ACCEPTED_TYPE } from '../acceptedMime.ts';

export const MAX_TITLE_LENGTH = 20;
export const MAX_HOOK_LENGTH = 120;
const MB = PUBLIC_MAX_IMAGE_SIZE_BYTES / 1024 ** 2;

const coverFile = z
  .instanceof(File, { error: 'Please choose a cover image' })
  .refine(
    (file) => file.size <= PUBLIC_MAX_IMAGE_SIZE_BYTES,
    `Please upload an image under ${MB} MB`,
  )
  .refine(
    (file) => ACCEPTED_TYPES.includes(file.type as ACCEPTED_TYPE),
    'Please use a JPG, PNG, or WebP image',
  );

export const createPublishSchema = (hasExistingCover: boolean) =>
  z.object({
    slug: z.string().min(1),
    tags: z.array(
      z.string()
        .trim()
        .min(1, 'Tag cannot be empty')
        .max(25, 'Tag must be at most 25 characters')
        .regex(/^[a-zA-Z0-9]+$/, 'Tag must contain only alphanumeric characters'),
    ).min(1).max(10),
    publishedTitle: z.string().trim().min(1).max(20),
    publishedHook: z.string().trim().min(1).max(120),
    coverImage: hasExistingCover ? coverFile.optional() : coverFile,
  });

export type PublishFormData = z.infer<ReturnType<typeof createPublishSchema>>;
