<script lang="ts">
  import { createForm } from 'felte';
  import { toast, Toaster } from 'svelte-sonner';
  import { navigate } from 'astro:transitions/client';
  import { client } from '../../api/client.ts';
  import Field from '../sign-up/Field.svelte';
  import Password from '../sign-up/Password.svelte';
  import Submit from '../sign-up/Submit.svelte';
  import { setSignUpData, setValidationErrors } from '../sign-up/context.ts';

  interface Data {
    email: string;
    password: string;
  }

  const { form } = createForm<Data>({
    onSubmit: async (body) => {
      try {
        const { data, error } = await client.POST('/v1/sessions', { body });

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

  setSignUpData(null);
  setValidationErrors(null);
</script>

<form use:form class="flex justify-center items-center grow">
  <div class="flex flex-col w-xl p-6 gap-5 h-max">
    <Field label="Email" name="email" type="email" />
    <Password />
    <Submit text="Log in" />
  </div>
</form>

<Toaster />

