import type { ACCEPTED_TYPE } from '../acceptedMime.ts';
import { apiClient, imagesClient } from '../clients.ts';
import { HTTPError, logMinioError } from '../errorHandling.ts';

export async function uploadImage(postId: string, file: File) {
  const {
    data: handoff,
    error: handoffError,
  } = await apiClient.GET('/api/jwt');

  if (!handoff && handoffError) {
    throw new HTTPError(handoffError);
  }

  const {
    data: permission,
    error: permissionError,
  } = await imagesClient.POST('/images/post-images/{postId}/request-upload/', {
    params: {
      header: {
        Authorization: `Bearer ${handoff.token}`,
      },
      path: { postId },
    },
    body: {
      mimeType: file.type as ACCEPTED_TYPE,
      sizeBytes: file.size,
    },
  });

  if (!permission && permissionError) {
    throw new HTTPError(permissionError);
  }

  const upload = await fetch(permission.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!upload.ok) {
    logMinioError(upload.status, await upload.text());

    throw new HTTPError({
      error: 'Upload Failed',
      message: 'Please try to upload your image again',
    });
  }

  const { data: image, error: confirmError } = await imagesClient.POST('/images/post-images/{postId}/{imageId}/confirm', {
    params: {
      header: {
        Authorization: `Bearer ${handoff.token}`,
      },
      path: {
        postId,
        imageId: permission.imageId,
      },
    },
  });

  if (!image && confirmError) {
    throw new HTTPError(confirmError);
  }

  return image;
}
