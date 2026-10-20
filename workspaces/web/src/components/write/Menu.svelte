<script lang="ts">
  import { Popover } from 'bits-ui';
  import { toast } from 'svelte-sonner';
  import { apiClient } from '../clients.ts';
  import { navigate } from 'astro:transitions/client';

  import Trash from '@lucide/svelte/icons/trash';
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';

  interface Props {
    postId: string;
  }

  const { postId }: Props = $props();

  async function handleDelete() {
    const { error } = await apiClient.DELETE('/api/me/drafts/{id}', {
      params: {
        path: {
          id: postId,
        },
      },
    });

    if (error) {
      toast.error(error.error, { description: error.message });
    }

    navigate('/my-drafts');
  }

  interface Option {
    text: string;
    icon: typeof Trash;
    handler: () => void;
  }

  const options: Option[] = [
    {
      text: 'Delete draft',
      icon: Trash,
      handler: handleDelete,
    }
  ];
</script>

<Popover.Root>
  <Popover.Trigger>
    <button
      title="Menu"
      aria-label="Open menu"
      class="text-stone-700 hover:text-stone-900 active:text-stone-950
        dark:text-stone-200 dark:hover:text-stone-100 dark:active:text-stone-50"
    >
      <EllipsisVertical size={18} />
    </button>
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

