<script lang="ts">
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import { toast } from 'svelte-sonner';
  import Toaster from '../common/Toaster.svelte';
  import { client } from '../../api/client.ts';
  import Field from './Field.svelte';
  import Submit from './Submit.svelte';
  import Password from './Password.svelte';
  import { schema, type SignUpData } from './schema.ts';
  import { setSignUpData, setValidationErrors } from './context.ts';
  import { navigate } from "astro:transitions/client";

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

  setSignUpData(data);
  setValidationErrors(errors);
</script>

<form use:form class="flex justify-center items-center grow">
  <div class="flex flex-col w-xl p-6 gap-5 h-max">
    <div class="flex gap-4 w-full">
      <Field label="First name" name="forename" />
      <Field label="Last name" name="surname" />
    </div>

    <Field label="Email" name="email" type="email" />
    <Password showStrength={true} />
    
    <Submit />
  </div>
</form>

<Toaster />
