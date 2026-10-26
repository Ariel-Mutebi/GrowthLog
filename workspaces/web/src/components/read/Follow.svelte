<script lang="ts">
  import Avatar from '../Avatar.svelte';
  import { apiClient } from '../clients.ts';
  import { HTTPError, toastError } from '../errorHandling.ts';

  interface Author {
    id: string;
    forename: string;
    surname: string;
    avatarKey: string | null;
  }

  interface Props {
    author: Author;
    readerId?: string ;
  }

  const { author, readerId }: Props = $props();

  async function handleFollow() {
    try {
      const { error } = await apiClient.PUT('/api/follow/{userId}', {
        params: {
          path: {
            userId: author.id,
          },
        },
      });

      if (error) throw new HTTPError(error);
    } catch (error) {
      toastError(error);
    }
  }
</script>

<div class="flex gap-3 pr-3 items-center justify-center w-max bg-stone-100 dark:bg-stone-900 rounded-2xl">
  <Avatar avatarKey={author.avatarKey} size="md" />
  <p class="text-base sm:text-lg">{author.forename} {author.surname}</p>
  <button
    disabled={readerId === author.id}
    onclick={handleFollow}
    class="py-0.5 px-10 font-bold bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300
      rounded-2xl inset-shadow-[2px_2px_2px] inset-shadow-stone-200 dark:inset-shadow-stone-800
      hover:text-stone-900 hover:dark:text-stone-100 active:text-stone-900 active:dark:text-stone-100
      text-sm sm:text-base"
  >
    Follow
  </button>
</div>
