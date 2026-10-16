export class ForbiddenError extends Error { };
export class UserNotFoundError extends Error { };
export class UserConflictError extends Error { };
export class EmailConflictError extends Error { };
export class UsernameConflictError extends Error { };

export class WeakPasswordError extends Error {
  constructor(public readonly suggestions: readonly string[]) {
    super();
  }
};
