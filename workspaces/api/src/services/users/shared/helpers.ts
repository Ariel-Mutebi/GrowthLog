import { zxcvbn } from 'zxcvbn-ts';
import { WeakPasswordError } from './errors.js';

type WithAvatar = {
  avatar: {
    image: {
      key: string;
    };
  } | null;
};

export function flattenAvatarKey<T extends WithAvatar>(user: T): Omit<T, 'avatar'> & { avatarKey: string | null } {
  const { avatar, ...rest } = user;

  return {
    ...rest,
    avatarKey: avatar?.image.key ?? null,
  };
}

export function assertStrongPassword(password: string): void {
  const { score, feedback } = zxcvbn(password);

  if (score < 3) {
    throw new WeakPasswordError(feedback.suggestions);
  }
}
