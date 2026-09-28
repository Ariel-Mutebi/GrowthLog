<script lang="ts">
  import { createForm } from 'felte';
  import Field from './Field.svelte';
  import Link from './Link.svelte';
  import Submit from './Submit.svelte';
  import Password from './Password.svelte';
  import Toaster from '../Toaster.svelte';
  import { client } from '../../api/client.ts';
  import { validator } from '@felte/validator-zod';
  import FieldWrapper from './FieldWrapper.svelte';
  import { navigate } from 'astro:transitions/client';
  import { SignUpSchema, type SignUpData } from './SignUpSchema.ts';
  import { HTTPError, toastError } from '../errorHandling.ts';
  import PasswordStrengthMeter from './PasswordStrengthMeter.svelte';

  const { form, data, errors } = createForm<SignUpData>({
    extend: validator({ schema: SignUpSchema }),
    onSubmit: async (body) => {
      const { data: user, error } = await client.POST('/api/users', { body });
      if (error) throw new HTTPError(error);
      return user;
    },
    onSuccess: () => navigate('/'),
    onError: toastError,
  });
</script>

<form use:form class="flex flex-col gap-4 sm:gap-8 p-4 sm:p-8 lg:px-16">
  <div class="flex gap-4 sm:gap-8 w-full">
    <Field label="First name" name="forename" errors={$errors.forename} />
    <Field label="Last name" name="surname" errors={$errors.surname} />
  </div>

  <Field label="Email" name="email" type="email" errors={$errors.email} />
  
  <FieldWrapper>
    <Password errors={$errors.password} />
    <PasswordStrengthMeter {...$data} />
  </FieldWrapper>
  
  <Submit text="Sign up" />

  <Link href="/login" text="Already have an account? Log in." />
</form>

<Toaster />
