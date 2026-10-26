<script lang="ts">
  import { Popover } from 'bits-ui';
  import { HTTPError, toastError } from '../errorHandling.ts';
  import { apiClient } from '../clients.ts';
  import { navigate } from 'astro:transitions/client';

  import Trash from '@lucide/svelte/icons/trash';
  import Eraser from '@lucide/svelte/icons/eraser';
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';

  interface Props {
    postId: string;
    hasPublished: boolean;
  }

  const { postId, hasPublished }: Props = $props();

  async function handleUnpublish() {
    try {
      const { error } = await apiClient.DELETE('/api/me/drafts/{id}/publish', {
        params: {
          path: {
            id: postId,
          },
        },
      });

      if (error) {
        throw new HTTPError(error);
      }
    } catch (error) {
      toastError(error);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await apiClient.DELETE('/api/me/drafts/{id}', {
        params: {
          path: {
            id: postId,
          },
        },
      });

      if (error) {
        throw new HTTPError(error);
      }

      navigate('/my-drafts');
    } catch (error) {
      toastError(error);
    }
  }

  interface Option {
    text: string;
    icon: typeof Trash;
    handler: () => void;
  }

  const options: Option[] = [
    {
      text: 'Delete',
      icon: Trash,
      handler: handleDelete,
    }
  ];

  // svelte-ignore state_referenced_locally
  if (hasPublished) {
    options.unshift({
      text: 'Unpublish',
      icon: Eraser,
      handler: handleUnpublish,
    });
  }
</script>

<Popover.Root>
  <Popover.Trigger
    title="Menu"
    aria-label="Open menu"
    class="flex items-center justify-center text-stone-700 hover:text-stone-900 active:text-stone-950
      dark:text-stone-200 dark:hover:text-stone-100 dark:active:text-stone-50"
  >
    <EllipsisVertical size={18} />
  </Popover.Trigger>
  <Popover.Content>
    <div class="bg-stone-50 border border-stone-200 text-stone-800 w-40">
      {#each options as option}
        <button
          onclick={option.handler}
          class="w-full flex justify-between items-center border border-stone-200
            p-2 hover:bg-stone-100"
        >
          {option.text}
          <option.icon size={18} />
        </button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>

