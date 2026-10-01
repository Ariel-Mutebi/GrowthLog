<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import FileImage from '@lucide/svelte/icons/file-image';
  import { ACCEPTED_TYPES } from './OnboardingSchema.ts';
  import Label from '../Label.svelte';

  interface Props {
    avatar?: File;
  }

  const { avatar }: Props = $props();
  let previewUrl = $state<string>();

  $effect(() => {
    if (!(avatar instanceof File)) {
      previewUrl = undefined;
      return;
    }

    const url = URL.createObjectURL(avatar);
    previewUrl = url;

    return () => URL.revokeObjectURL(url);
  });

</script>

<div class="flex flex-col gap-2">
  <Label name="avatar" label="Avatar" variant="light" />

  <div class="border border-stone-200 dark:border-stone-600 w-min">
    <label
      for="avatar"
      class="h-23 w-23 sm:h-32 sm:w-32 bg-stone-400 dark:bg-stone-600
        rounded-full flex items-center justify-center"
    >
      {#if previewUrl}
        <img
          src={previewUrl}
          alt="Avatar preview"
          class="w-full h-full object-cover rounded-full"
        />
      {:else}
        <Plus size={36} class="text-orange-50 dark:text-red-950" />
      {/if}
    </label>
  </div>

  <label
    for="avatar"
    class="bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300
      hover:bg-stone-300 hover:dark:bg-stone-700 grid grid-cols-[16px_1fr] p-1
      gap-1 items-center w-23.5 sm:w-32.5"
  >
    <FileImage size={16} />
    <span class="text-xs truncate w-full">
      {#if avatar instanceof File}
        {avatar.name}
      {:else}
        No file selected
      {/if}
    </span>
  </label>

  <input
    type="file"
    name="avatar"
    id="avatar"
    class="sr-only"
    accept={ACCEPTED_TYPES.join(',')}
  >
</div>
