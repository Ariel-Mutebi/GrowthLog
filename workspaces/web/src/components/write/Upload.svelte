<script lang="ts">
  import { toast } from 'svelte-sonner';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import {
    PUBLIC_MAX_IMAGE_SIZE_BYTES,
    PUBLIC_MINIO_ENDPOINT,
    PUBLIC_IMAGE_BUCKET,
  } from 'astro:env/client';

  import { uploadImage } from './upload.ts';
  import { HTTPError } from '../errorHandling.ts';
  import type { ImageUploaded } from './events.ts';
  import { ACCEPTED_TYPES, type ACCEPTED_TYPE } from '../acceptedMime.ts';

  interface Props {
    postId: string;
  }

  const { postId }: Props = $props();
  let fileInput: HTMLInputElement;
  let uploading = $state(false);

  async function onFileChosen(event: Event & { currentTarget: HTMLInputElement }) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type as ACCEPTED_TYPE)) {
      return toast.error('Unsupported file type', {
        description: 'Please use a JPG, PNG, or WebP image',
      });
    }

    if (file.size > PUBLIC_MAX_IMAGE_SIZE_BYTES) {
      return toast.error('Image too large', {
        description: `Please upload an image under ${PUBLIC_MAX_IMAGE_SIZE_BYTES / 1024 ** 2} MB`,
      });
    }

    let uploading = true;
    try {
      const image = await uploadImage(postId, file);
      
      window.dispatchEvent(
        new CustomEvent('editor:image-uploaded', {
          detail: {
            src: `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_IMAGE_BUCKET}/${image.key}`,
            width: image.width ?? undefined,
            height: image.height ?? undefined,
          } satisfies ImageUploaded,
        })
      );
    } catch (error) {
      if (error instanceof HTTPError) {
        return toast.error(error.error, { description: error.message });
      }

      console.error(error);
      toast.error('Could not upload image');
    } finally {
      uploading = false;
    }
  }
</script>

<button
  type="button"
  title="Add image"
  aria-label="Add image"
  disabled={uploading}
  onclick={() => fileInput.click()}
  class="cursor-pointer text-stone-700 disabled:text-stone-500 hover:text-stone-900
    active:text-stone-950 dark:text-stone-200 dark:disabled:text-stone-400
    dark:hover:text-stone-100 dark:active:text-stone-50"
>
  {#if uploading}
    <LoaderCircle size={18} class="animate-spin" />
  {:else}
    <ImagePlus size={18} />
  {/if}
</button>

<input
  type="file"
  class="hidden"
  bind:this={fileInput}
  accept={ACCEPTED_TYPES.join(',')}
  onchange={onFileChosen}
/>
