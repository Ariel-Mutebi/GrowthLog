<script lang="ts">
  import Lock from '@lucide/svelte/icons/lock';
  import Globe from '@lucide/svelte/icons/globe';

  interface Props {
    slug: string;
    title: string;
    isPrivate: boolean;
    updatedAt: Date;
  }

  const { slug, title, isPrivate, updatedAt }: Props = $props();

  // svelte-ignore state_referenced_locally
  const lastEdited = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(updatedAt);
</script>

<li class="hover:bg-stone-100 active:bg-stone-100 hover:dark:bg-stone-900 hover:active:bg-stone-900 active:dark:bg-stone-100">
  <a
    href={`/edit/${slug}`}
    class="flex items-center p-3 md:px-8 md:py-4 gap-3 md:gap-8 font-serif"
  >
    <p class="text-base sm:text-xl md:text-2xl grow">{title}</p>
    <div
      class={[
        'flex p-2 gap-2 items-center rounded-2xl sm:pr-4',
        { 'bg-slate-200 dark:bg-slate-800': isPrivate },
        { 'bg-lime-100 dark:bg-lime-800': !isPrivate },
      ]}
    >
      {#if isPrivate}
        <Lock size={16} />
      {:else}
        <Globe size={16} />
      {/if}
      <span class="hidden sm:inline">{isPrivate ? 'Private' : 'Published'}</span>
    </div>
    <time
      datetime={updatedAt.toDateString()}
      class="text-sm sm:text-base text-stone-700 dark:text-stone-400"
    >
      {lastEdited}
    </time>
  </a>
</li>

<style>
  li:not(:last-child) {
    border-bottom: 1px solid var(--color-stone-400);
  }

  :global(.dark) li:not(:last-child) {
    border-bottom-color: var(--color-stone-600);
  }
</style>
