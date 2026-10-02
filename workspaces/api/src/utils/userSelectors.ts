import type { UserSelect } from '@growthlog/db';

export const publicSafeSelect = {
  id: true,
  forename: true,
  surname: true,
  username: true,
  createdAt: true,
  bio: true,
  avatar: {
    select: {
      image: {
        select: {
          key: true,
        },
      },
    },
  },
} satisfies UserSelect;

export const clientSafeSelect = {
  ...publicSafeSelect,
  email: true,
} satisfies UserSelect;

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
