<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div class="flex flex-col gap-1 sm:gap-3 w-full">
  {@render children()}
</div>
