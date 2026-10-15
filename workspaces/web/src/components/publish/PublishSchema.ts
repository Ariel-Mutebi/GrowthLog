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
    publishedTitle: z.string().min(1),
    publishedSlug: z.string().min(1),
    publishedHook: z.string().max(120),
    coverImage: hasExistingCover ? coverFile.optional() : coverFile,
  });

export type PublishFormData = z.infer<ReturnType<typeof createPublishSchema>>;
