<script>
  import { Toaster } from 'svelte-sonner';
  import { CircleX } from '@lucide/svelte';
</script>

<Toaster
  toastOptions={{
    unstyled: true,
    classes: {
      toast: 'text-neutral-900 bg-neutral-100 dark:text-neutral-50 dark:bg-neutral-800 text-sm font-mono px-2 py-2 flex gap-2 items-center',
    },
  }}
>
  {#snippet errorIcon()}
    <CircleX class="text-red-400" />
  {/snippet}
  {#snippet successIcon()}
    <CircleCheck class="text-green-400" />
  {/snippet}
  {#snippet warningIcon()}
    <TriangleAlert class="text-orange-400" />
  {/snippet}
  {#snippet infoIcon()}
    <Info class="text-blue-600" />
  {/snippet}
</Toaster>
