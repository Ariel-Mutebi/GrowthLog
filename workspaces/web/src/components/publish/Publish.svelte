<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';

  import { toastError } from '../errorHandling.ts';
  import type { Prepublish } from '../../types/backend.ts';
  import { createPublishSubmit } from './publishSubmit.ts';
  import { createPublishSchema, type PublishFormData } from './PublishSchema.ts';

  import AddressBarInput from './AddressBarInput.svelte';
  import ChromeTab from './ChromeTab.svelte';
  import Textarea from '../Textarea.svelte';
  import CoverImagePicker from './CoverImagePicker.svelte';
  import TextareaLimited from '../TextareaLimited.svelte';
  import Tags from './Tags.svelte';
  import Submit from '../Submit.svelte';
  import Toaster from '../Toaster.svelte';

  interface Props {
    postId: string;
    initial: Prepublish;
    mockUrlBase: string;
  }

  const { postId, initial, mockUrlBase }: Props = $props();

  const { form, data, errors, isSubmitting, setFields } = createForm<PublishFormData>({
    extend: validator({ schema: createPublishSchema(Boolean(initial.coverImageId)) }),
    initialValues: {
      slug: initial.slug,
      tags: [],
      publishedTitle: initial.publishedTitle,
      publishedHook: initial.publishedHook,
    },
    onSubmit: createPublishSubmit(postId, initial.coverImageId!),
    onError: toastError,
  });

  let selectedTags = $state<string[]>([]);

  $effect(() => {
    setFields('tags', [...selectedTags]);
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
      <Tags
        bind:value={selectedTags}
        errors={$errors.tags}
      />
      <Submit
        text="Publish"
        isSubmitting={$isSubmitting}
      />
    </div>
  </form>
</main>

<Toaster />
