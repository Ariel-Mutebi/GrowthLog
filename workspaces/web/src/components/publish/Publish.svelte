<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import { navigate } from 'astro:transitions/client';

  import { apiClient } from '../clients.ts';
  import { toastError } from '../errorHandling.ts';
  import { uploadPostImage } from '../write/upload.ts';
  import type { Prepublish } from '../../types/backend.ts';
  import { createPublishSchema, type PublishFormData } from './PublishSchema.ts';

  import AddressBarInput from './AddressBarInput.svelte';
  import ChromeTab from './ChromeTab.svelte';
  import Textarea from '../Textarea.svelte';
  import CoverImagePicker from './CoverImagePicker.svelte';
  import TextareaLimited from '../TextareaLimited.svelte';
  import Submit from '../Submit.svelte';

  interface Props {
    postId: string;
    initial: Prepublish;
    mockUrlBase: string;
  }

  const { postId, initial, mockUrlBase }: Props = $props();

  const { form, data, errors, isSubmitting } = createForm<PublishFormData>({
    extend: validator({ schema: createPublishSchema(Boolean(initial.coverImageId)) }),
    initialValues: {
      slug: initial.slug,
      publishedTitle: initial.publishedTitle,
      publishedHook: initial.publishedHook,
    },
    onSubmit: async ({ slug, publishedTitle, publishedHook, coverImage }) => {
      let coverImageId: string;

      if (coverImage) {
        const uploaded = await uploadPostImage(postId, coverImage);
        coverImageId = uploaded.id;
      } else {
        coverImageId = initial.coverImageKey!;
      }

      await apiClient.POST('/api/me/drafts/{id}/publish', {
        params: {
          path: {
            id: postId,
          },
        },
        body: {
          slug,
          publishedTitle,
          publishedHook,
          coverImageId,
        },
      });

      navigate(`/${slug}/read`);
    },
    onError: toastError,
  });
</script>

<main
  class="bg-stone-100 dark:bg-stone-600 rounded-t-3xl sm:mx-6 pt-2 max-w-200
    grow basis-md shadow-[0_0_64px_4px] shadow-white/50 dark:shadow-white/25"
>
  <ChromeTab title={$data.publishedTitle} />
  <form use:form>
    <AddressBarInput {mockUrlBase} />
    <div class="bg-white dark:bg-stone-900 p-8 grid gap-8">
      <Textarea
        name="publishedTitle"
        errors={$errors.publishedTitle}
        extraClasses="font-serif text-6xl text-stone-800 soft pb-4"
      />
      <CoverImagePicker
        uploadedFile={$data.coverImage}
        defaultKey={initial.coverImageKey}
        errors={$errors.coverImage}
      />
      <TextareaLimited
        name="publishedHook"
        label="Hook"
        rows={2}
        current={$data.publishedHook?.length}
        maximum={120}
        errors={$errors.publishedHook}
      />
      <Submit
        text="Publish"
        isSubmitting={$isSubmitting}
      />
    </div>
  </form>
</main>
