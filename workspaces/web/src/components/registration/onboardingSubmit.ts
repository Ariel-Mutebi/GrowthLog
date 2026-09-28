import { HTTPError } from '../errorHandling.ts';
import { apiClient, imagesClient } from '../clients.ts';
import type { OnboardingData, ACCEPTED_TYPE } from './OnboardingSchema.ts';

export async function handleOnboardingSubmit({ username, bio, avatar }: OnboardingData) {
  const {
    data: jwt,
    error: jwtError,
  } = await apiClient.GET('/api/jwt');

  if (!jwt) {
    throw new HTTPError(jwtError!);
  }

  const {
    data: permission,
    error: requestUploadError,
  } = await imagesClient.POST('/images/avatars/request-upload', {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: {
      mimeType: avatar.type as ACCEPTED_TYPE,
      sizeBytes: avatar.size,
    },
  });

  if (!permission) {
    throw new HTTPError(requestUploadError!);
  }

  const upload = await fetch(permission.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': avatar.type,
    },
    body: avatar,
  });

  if (!upload.ok) {
    const xml = await upload.text();
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const code = doc.querySelector('Code')?.textContent;
    const message = doc.querySelector('Message')?.textContent;

    console.error('PUT request to Minio container failed\n', {
      status: upload.status,
      code,
      message,
    });

    throw new HTTPError({
      error: 'Upload Failed',
      message: 'Please try to upload your picture again',
    });
  }

  const { error: confirmError } = await imagesClient.POST('/images/avatars/{id}/confirm', {
    params: {
      path: {
        id: permission.imageId,
      },
    },
  });

  if (confirmError) {
    throw new HTTPError(confirmError);
  }

  const { error: updateError } = await apiClient.PATCH('/api/users', {
    body: {
      username,
      bio,
      avatarId: permission.imageId,
    },
  });

  if (updateError) {
    throw new HTTPError(updateError);
  }
}
