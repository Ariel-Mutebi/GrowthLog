<script lang="ts">
  import { onMount } from 'svelte';
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import { navigate } from 'astro:transitions/client';

  import { toastError } from '../errorHandling.ts';
  import {
    OnboardingSchema,
    type OnboardingData,
  } from './OnboardingSchema.ts';
  import { getCurrentUser } from '../currentUser.ts';
  import { handleOnboardingSubmit } from './onboardingSubmit.ts';

  import Input from '../Input.svelte';
  import Label from '../Label.svelte';
  import Toaster from '../Toaster.svelte';
  import Textarea from '../Textarea.svelte';
  import Error from '../registration/Error.svelte';
  import FieldWrapper from '../FieldWrapper.svelte';
  import AvatarPicker from './AvatarPicker.svelte';
  import Submit from '../registration/Submit.svelte';
  import CharacterCount from '../CharacterCount.svelte';

  const { form, data, errors, isSubmitting } = createForm<OnboardingData>({
    extend: validator({ schema: OnboardingSchema }),
    onSubmit: handleOnboardingSubmit,
    onSuccess: () => navigate('/'),
    onError: toastError,
  });

  onMount(async () => {
    const { username } = await getCurrentUser();
    data.update((current) => ({ ...current, username }));
  });
</script>

<form use:form class="flex flex-col gap-8 p-4 sm:p-8 lg:px-16">
  <div class="flex gap-4 sm:gap-8">
    <AvatarPicker avatar={$data.avatar} errors={$errors.avatar} />

    <div class="grid gap-4 w-full">
      <FieldWrapper>
        <Label name="username" label="Username" variant="light" />
        <Input name="username" padded={false} variant="header" />
        {#if $errors.username}
          <Error errors={$errors.username} />          
        {/if}
      </FieldWrapper>

      <FieldWrapper>
        <div class="flex justify-between">
          <Label name="bio" label="Bio" variant="light" />
          {#if $data.bio}
            <CharacterCount current={$data.bio.length} maximum={200} />   
          {/if}
        </div>
        <Textarea name="bio" />
        {#if $errors.bio}
          <Error errors={$errors.bio} />          
        {/if}
      </FieldWrapper>
    </div>
  </div>

  <Submit text="Done" isSubmitting={$isSubmitting} />
</form>

<Toaster />
