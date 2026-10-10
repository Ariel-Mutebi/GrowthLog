<script lang="ts">
  import { Popover } from 'bits-ui';
  import type { DraftFilters } from './Filters.ts';
  import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';

  let { filters = $bindable() }: { filters: DraftFilters } = $props();
  let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <button
      aria-pressed={open}
      aria-label="Open filters"
    >
      <ArrowDownUp />
    </button>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content side="top" align="end" sideOffset={8}>
      <form class="bg-stone-100">
        <fieldset>
          <legend>Sort by:</legend>
          <label>
            <input type="radio" bind:group={filters.orderBy} value="title" />
            Title
          </label>
          <label>
            <input type="radio" bind:group={filters.orderBy} value="updatedAt" />
            Last Edited
          </label>
        </fieldset>

        <fieldset>
          <legend>Order:</legend>
          <label>
            <input type="radio" bind:group={filters.order} value="asc" />
            Ascending
          </label>
          <label>
            <input type="radio" bind:group={filters.order} value="desc" />
            Descending
          </label>
        </fieldset>

        <fieldset>
          <legend>Status:</legend>
          <label>
            <input
              type="checkbox"
              bind:checked={filters.isPrivate}
              disabled={filters.isPrivate && !filters.isPublished}
            />
            Private
          </label>
          <label>
            <input
              type="checkbox"
              bind:checked={filters.isPublished}
              disabled={filters.isPublished && !filters.isPrivate}
            />
            Published
          </label>
        </fieldset>
      </form>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
