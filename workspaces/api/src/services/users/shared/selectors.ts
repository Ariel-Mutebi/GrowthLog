import type { UserSelect } from '@growthlog/db';

export const avatarSelect = {
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

export const publicSelect = {
  id: true,
  forename: true,
  surname: true,
  username: true,
  createdAt: true,
  bio: true,
  ...avatarSelect,
} satisfies UserSelect;

export const personalSelect = {
  id: true,
  forename: true,
  surname: true,
  username: true,
  createdAt: true,
  bio: true,
  email: true,
  ...avatarSelect,
} satisfies UserSelect;
