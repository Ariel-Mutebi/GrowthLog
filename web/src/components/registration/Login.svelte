<script lang="ts">
  import { createForm } from 'felte';
  import { toast } from 'svelte-sonner';
  import { client } from '../../api/client.ts';
  import { navigate } from 'astro:transitions/client';

  import Field from './Field.svelte';
  import Password from './Password.svelte';
  import Submit from './Submit.svelte';
  import Link from "./Link.svelte";
  import Toaster from '../Toaster.svelte';

  interface Data {
    email: string;
    password: string;
  }

  const { form } = createForm<Data>({
    onSubmit: async (body)  => {
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
    }
  })
</script>

<form use:form class="flex flex-col gap-8 lg:px-8">
  <Field label="Email" name="email" type="email" />
  <Password />
  <Submit text="Log in" />
  <Link href="/sign-up" text="Don't have an account? Sign up!" />
</form>

<Toaster />
