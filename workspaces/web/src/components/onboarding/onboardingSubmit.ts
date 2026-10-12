import { HTTPError, logMinioError } from '../errorHandling.ts';
import { apiClient, imagesClient } from '../clients.ts';
import type { OnboardingData } from './OnboardingSchema.ts';
import type { ACCEPTED_TYPE } from '../acceptedMime.ts';

async function uploadAvatar(avatar: File) {
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
  } = await imagesClient.POST('/images/avatars/request-upload', {
    params: {
      header: {
        Authorization: `Bearer ${handoff.token}`,
      },
    },
    body: {
      mimeType: avatar.type as ACCEPTED_TYPE,
      sizeBytes: avatar.size,
    },
  });

  if (!permission && permissionError) {
    throw new HTTPError(permissionError);
  }

  const upload = await fetch(permission.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': avatar.type,
    },
    body: avatar,
  });

  if (!upload.ok) {
    logMinioError(upload.status, await upload.text());

    throw new HTTPError({
      error: 'Upload Failed',
      message: 'Please try to upload your avatar again',
    });
  }

  const { error: confirmError } = await imagesClient.POST('/images/avatars/{id}/confirm', {
    params: {
      header: {
        Authorization: `Bearer ${handoff.token}`,
      },
      path: {
        id: permission.imageId,
      },
    },
  });

  if (confirmError) {
    throw new HTTPError(confirmError);
  }
}

export async function handleOnboardingSubmit({ username, bio, avatar }: OnboardingData) {
  const { error: updateError } = await apiClient.PATCH('/api/users', {
    body: { username, bio },
  });

  if (updateError) {
    throw new HTTPError(updateError);
  }

  if (avatar) uploadAvatar(avatar);
}
