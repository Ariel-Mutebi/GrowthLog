<script lang="ts">
  import { toast } from 'svelte-sonner';
  import Toaster from '../Toaster.svelte';
  import { apiClient } from '../clients.ts';
  import type { Drafts } from '../../types/backend.ts';
  import Filters from './Filters.svelte';
  import type { DraftFilters } from './Filters.ts';

  let drafts = $state<Drafts>();
  let filters = $state<DraftFilters>({
    orderBy: 'updatedAt',
    order: 'desc',
    isPrivate: true,
    isPublished: true,
  });

  $effect(() => {
    const { orderBy, order, isPrivate, isPublished } = filters;
    const published = isPrivate === isPublished ? undefined: isPublished;

    apiClient.GET('/api/posts', {
      params: {
        query: {
          orderBy,
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

<Filters bind:filters />
<ul>
  {#each drafts as draft}
    <li>
      <a href={`edit/${draft.id}`}>{draft.title}</a>
    </li>
  {/each}
</ul>

<Toaster />
