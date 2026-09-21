<script lang="ts">
  import { CircleAlert } from '@lucide/svelte';

  interface Props {
    message: string;
  }

  const { message }: Props = $props();
</script>

<div class="flex gap-1 bg-red-200 dark:bg-red-800">
  <span class="text-red-900 dark:text-red-200">
    <CircleAlert />
  </span>

  <p class="text-stone-900 dark:text-stone-100">{message}</p>
</div>
