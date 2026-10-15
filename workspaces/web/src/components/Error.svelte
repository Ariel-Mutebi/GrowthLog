<script lang="ts">
  import CircleAlert from '@lucide/svelte/icons/circle-alert';

  interface Props {
    errors: string[];
  }

  const { errors }: Props = $props();
</script>

<div class="flex gap-1 bg-red-200 dark:bg-red-800 rounded-3xl px-3 py-1">
  <span class="text-red-900 dark:text-red-200">
    <CircleAlert />
  </span>

  <p class="text-stone-900 dark:text-stone-100">{errors[0]}</p>
</div>
