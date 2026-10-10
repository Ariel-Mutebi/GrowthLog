<script lang="ts">
  import { toast } from 'svelte-sonner';
  import Toaster from '../Toaster.svelte';
  import { apiClient } from '../clients.ts';
  import type { DraftFilters } from './Filters.ts';
  import type { Drafts } from '../../types/backend.ts';

  import Item from './Item.svelte';
  import Filters from './Filters.svelte';

  let drafts = $state<Drafts>();
  let filters = $state<DraftFilters>({
    sortBy: 'updatedAt',
    order: 'desc',
    isPrivate: true,
    isPublished: true,
  });

  $effect(() => {
    const { sortBy, order, isPrivate, isPublished } = filters;
    const published = isPrivate === isPublished ? undefined: isPublished;

    apiClient.GET('/api/posts', {
      params: {
        query: {
          sortBy,
          order,
          published,
        },
      },
    }).then(({ data, error }) => {
      if (data && !error) {
        drafts = data;
      } else {
        toast.error(error.error, { description: error.message });
      }
    }).catch((error) => {
      toast.error(error);
    });
  });
</script>

<main class="py-9 px-6 md:pt-16 flex justify-center">
  <div class="w-full max-w-225 text-stone-900 dark:text-stone-200">
    {#if drafts}
      <div class="flex w-full px-8 gap-8 justify-end">
        <Filters bind:filters />
        <p>Last edited</p>
      </div>

      <ul>
        {#each drafts as draft}
          <Item
            slug={draft.slug}
            title={draft.title}
            updatedAt={new Date(draft.updatedAt)}
            isPrivate={draft.publishedAt === null}
          />
        {/each}
      </ul>
    {/if}
  </div>
</main>

<Toaster />
