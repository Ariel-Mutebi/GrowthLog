<script>
  import { Toaster } from 'svelte-sonner';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import Info from '@lucide/svelte/icons/info';
</script>

<Toaster
  toastOptions={{
    unstyled: true,
    classes: {
      toast: 'text-neutral-900 bg-neutral-100 dark:text-neutral-50 dark:bg-neutral-800\
        text-sm font-mono px-2 py-2 flex gap-2 items-center min-w-50',
    },
  }}
>
  {#snippet errorIcon()}
    <CircleAlert class="text-red-400" />
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
