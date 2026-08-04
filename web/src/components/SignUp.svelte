<script lang="ts">
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import Field from './sign-up/Field.svelte';
  import { schema } from './sign-up/schema.ts';

  const { form, errors } = createForm({
    extend: validator({ schema }),
  });

</script>

<form use:form class="flex justify-center items-center grow">
  <div class="flex flex-col w-xl px-6 gap-5 h-max">
    <div class="flex gap-4 w-full">
      <Field label="First name" name="firstName" />
      <Field label="Last name" name="lastName" />
    </div>

    <Field label="Email" name="email" type="email" />
    <Field label="Password" name="password" type="password" />
    
    <button
      type="submit"
      class="p-2 rounded-lg text-white text-xl bg-linear-to-r from-black/60 to-black"
    >
      Sign up
    </button>
  </div>
</form>
