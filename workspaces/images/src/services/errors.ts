export class ImageNotFoundError extends Error { }
export class UploadAlreadyFailedError extends Error { }
export class ObjectNotUploadedError extends Error { }
export class FileTypeMismatchError extends Error { }
export class FileTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super();
  }
}
