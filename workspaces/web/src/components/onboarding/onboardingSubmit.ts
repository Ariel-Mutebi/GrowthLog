import { HTTPError } from '../errorHandling.ts';
import { apiClient, imagesClient } from '../clients.ts';
import type { OnboardingData, ACCEPTED_TYPE } from './OnboardingSchema.ts';

async function uploadAvatar(avatar: File) {
  const {
    data: handoff,
    error: jwtError,
  } = await apiClient.GET('/api/jwt');

  if (!handoff) {
    throw new HTTPError(jwtError!);
  }

  const {
    data: permission,
    error: requestUploadError,
  } = await imagesClient.POST('/images/avatars/request-upload', {
    headers: {
      Authorization: `Bearer ${handoff.token}`,
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
    headers: {
      Authorization: `Bearer ${handoff.token}`,
    },
    params: {
      path: {
        id: permission.imageId,
      },
    },
  });

  if (confirmError) {
    throw new HTTPError(confirmError);
  }

  return permission.imageId;
}

export async function handleOnboardingSubmit({ username, bio, avatar }: OnboardingData) {
  const avatarId = avatar ? await uploadAvatar(avatar) : undefined;

  const { error: updateError } = await apiClient.PATCH('/api/users', {
    body: {
      username,
      bio,
      avatarId,
    },
  });

  if (updateError) {
    throw new HTTPError(updateError);
  }
}
