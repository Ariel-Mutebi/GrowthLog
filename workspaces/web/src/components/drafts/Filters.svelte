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
      class="p-2 rounded-full aria-pressed:bg-stone-200 aria-pressed:dark:bg-stone-800"
    >
      <ArrowDownUp size={16} />
    </button>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content side="top" align="end" sideOffset={8}>
      <form class="p-2 pr-8 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-600">
        <fieldset>
          <legend>Sort by:</legend>
          <label>
            <input type="radio" bind:group={filters.sortBy} value="title" />
            Title
          </label>
          <label>
            <input type="radio" bind:group={filters.sortBy} value="updatedAt" />
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

<style>
  fieldset {
    margin-bottom: var(--spacing);
  }

  fieldset > * {
    display: block;
  }

  legend {
    font-family: var(--font-mono);
    color: var(--color-stone-900);
  }

  :global(.dark) legend {
    color: var(--color-stone-100);
  }

  label {
    font-size: var(--text-sm);
    color: var(--color-stone-700);
  }

  :global(.dark) label {
    color: var(--color-stone-300);
  }
</style>
