<script lang="ts">
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import { toast } from 'svelte-sonner';
  import Toaster from '../Toaster.svelte';
  import { client } from '../../api/client.ts';
  import Field from './Field.svelte';
  import Password from './Password.svelte';
  import { schema, type SignUpData } from './schema.ts';
  import { navigate } from "astro:transitions/client";
  import FieldWrapper from './FieldWrapper.svelte';
  import PasswordStrengthMeter from './PasswordStrengthMeter.svelte';
  import Submit from './Submit.svelte';

  const { form, data, errors } = createForm<SignUpData>({
    extend: validator({ schema }),
    onSubmit: async (body) => {
      try {
        const { data, error } = await client.POST('/v1/users', { body });

        if (error) {
          return toast.error(error.error, { description: error.message });
        }

        if (data) {
          return navigate('/');
        }
      } catch (error) {
        toast.error(String(error));
      }
    },
  });
</script>

<form use:form class="flex flex-col gap-8 px-8">
  <div class="flex gap-8 w-full">
    <Field label="First name" name="forename" errors={$errors.forename} />
    <Field label="Last name" name="surname" errors={$errors.surname} />
  </div>

  <Field label="Email" name="email" type="email" errors={$errors.email} />
  
  <FieldWrapper>
    <Password errors={$errors.password} />
    <PasswordStrengthMeter {...$data} />
  </FieldWrapper>
  
  <Submit text="Sign up" />
</form>

<Toaster />
