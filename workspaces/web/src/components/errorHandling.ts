import { toast } from 'svelte-sonner';

export class HTTPError extends Error {
  public readonly error: string;
  public readonly message: string;

  constructor(
    error: {
      error: string;
      message: string;
    },
  ) {
    super(error.error);
    this.error = error.error;
    this.message = error.message;
  }
}

export function toastError(error: unknown) {
  console.error(error);

  if (error instanceof HTTPError) {
    toast.error(error.error, {
      description: error.message,
    });
  } else {
    toast.error(String(error));
  }
}

export function logMinioError(status: number, xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const code = doc.querySelector('Code')?.textContent;
  const message = doc.querySelector('Message')?.textContent;

  console.error('Request to Minio container failed\n', { status, code, message });
}
