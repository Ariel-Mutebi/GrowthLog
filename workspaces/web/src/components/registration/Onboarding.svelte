<script lang="ts">
  import { onMount } from 'svelte';
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import { navigate } from 'astro:transitions/client';

  import { toastError } from '../errorHandling.ts';
  import {
    ACCEPTED_TYPES,
    OnboardingSchema,
    type OnboardingData,
  } from './OnboardingSchema.ts';
  import { getCurrentUser, type User } from '../currentUser.ts';
  import { handleOnboardingSubmit } from './onboardingSubmit.ts';

  import Error from './Error.svelte';
  import Submit from './Submit.svelte';
  import Toaster from '../Toaster.svelte';

  let user = $state<User>();

  onMount(async () => {
    user = await getCurrentUser();
  });

  const { form, data, errors, isSubmitting } = createForm<OnboardingData>({
    extend: validator({ schema: OnboardingSchema }),
    onSubmit: handleOnboardingSubmit,
    onSuccess: () => navigate('/'),
    onError: toastError,
  });

  let previewURL = $state<string | null>(null);

  $effect(() => {
    const file = $data.avatar;

    if (!(file instanceof File)) {
      previewURL = null;
      return;
    }

    const url = URL.createObjectURL(file);
    previewURL = url;

    return () => URL.revokeObjectURL(url);
  });
</script>

<form use:form>
  <div>
    <label for="avatar">Profile picture</label>
    {#if previewURL}
      <img src={previewURL} alt="Profile preview" class="w-30 h-30">
    {/if}
    <input
      type="file"
      name="avatar"
      id="avatar"
      accept={ACCEPTED_TYPES.join(',')}
    >
    {#if $errors.avatar}
      <Error errors={$errors.avatar} />
    {/if}
  </div>

  <div>
    <div>
      <label for="username">Username</label>
      <input
        type="text"
        name="username"
        id="username"
        value={user?.username}
      >
      {#if $errors.username}
        <Error errors={$errors.username} />
      {/if}
    </div>
    <div>
      <label for="bio">Bio</label>
      {#if $data.bio}
        <p>{$data.bio.length}/200</p>        
      {/if}
      <textarea name="bio" id="bio" rows="4"></textarea>
      {#if $errors.bio}
        <Error errors={$errors.bio} />
      {/if}
    </div>
  </div>

  <Submit text="Done" isSubmitting={$isSubmitting} />
</form>

<Toaster />
