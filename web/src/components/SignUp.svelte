<script lang="ts">
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import Field from './sign-up/Field.svelte';
  import Submit from './sign-up/Submit.svelte';
  import Password from './sign-up/Password.svelte';
  import { schema, type SignUpData } from './sign-up/schema.ts';
  import { setValidationErrors } from './sign-up/context.ts';

  const { form, data, errors } = createForm<SignUpData>({
    extend: validator({ schema }),
  });

  setValidationErrors(errors);
</script>

<form use:form class="flex justify-center items-center grow">
  <div class="flex flex-col w-xl px-6 gap-5 h-max">
    <div class="flex gap-4 w-full">
      <Field label="First name" name="firstName" />
      <Field label="Last name" name="lastName" />
    </div>

    <Field label="Email" name="email" type="email" />
    <Password { data } />
    
    <Submit />
  </div>
</form>
