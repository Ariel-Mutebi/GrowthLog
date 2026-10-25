import { navigate } from 'astro:transitions/client';
import { apiClient } from '../clients.ts';
import { HTTPError } from '../errorHandling.ts';
import { uploadPostImage } from '../write/upload.ts';
import type { PublishFormData } from './PublishSchema.ts';

export const createPublishSubmit = (postId: string, defaultCoverImageId: string) =>
  async ({ slug, tags, publishedTitle, publishedHook, coverImage }: PublishFormData) => {
  let coverImageId: string;

  if (coverImage) {
    const uploaded = await uploadPostImage(postId, coverImage);
    coverImageId = uploaded.id;
  } else {
    coverImageId = defaultCoverImageId;
  }

  const { error } = await apiClient.POST('/api/me/drafts/{id}/publish', {
    params: {
      path: {
        id: postId,
      },
    },
    body: {
      slug,
      tags,
      publishedTitle,
      publishedHook,
      coverImageId,
    },
  });

  if (error) {
    throw new HTTPError(error);
  }

  navigate(`/${slug}`);
};
