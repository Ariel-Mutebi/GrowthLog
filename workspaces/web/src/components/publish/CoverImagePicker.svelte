<script lang="ts">
  import { PUBLIC_MINIO_ENDPOINT, PUBLIC_IMAGE_BUCKET } from 'astro:env/client';
  import { ACCEPTED_TYPES } from '../acceptedMime.ts';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import Error from '../Error.svelte';

  interface Props {
    uploadedFile?: File;
    defaultKey: string | null;
    errors: string[] | null;
  }

  const { uploadedFile, defaultKey, errors }: Props = $props();
  let localUrl = $state<string>();

  $effect(() => {
    if (!(uploadedFile instanceof File)) {
      localUrl = undefined;
      return;
    }

    const url = URL.createObjectURL(uploadedFile);
    localUrl = url;

    return () => URL.revokeObjectURL(url);
  });

  // svelte-ignore state_referenced_locally
  const defaultUrl = defaultKey ? `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_IMAGE_BUCKET}/${defaultKey}` : undefined;
  const previewUrl = $derived(localUrl ?? defaultUrl);
</script>

<div class="relative w-full flex flex-col items-center gap-2">
  <label
    for="cover-image"
    class="w-full aspect-4/3 max-w-100 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700
      dark:hover:bg-stone-600 border-2 border-dashed border-stone-400 dark:border-stone-500
      flex items-center justify-center cursor-pointer"
  >
    {#if previewUrl}
      <img
        src={previewUrl}
        alt="Post cover"
        class="h-full w-full object-cover"
      >
    {:else}
      <ImagePlus size={48} class="text-stone-800 dark:text-stone-300" />
    {/if}
  </label>

  <input
    type="file"
    name="coverImage"
    id="cover-image"
    class="sr-only"
    accept={ACCEPTED_TYPES.join(',')}
  >

  {#if errors}
    <Error {errors} />
  {/if}
</div>
