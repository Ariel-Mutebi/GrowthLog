<script lang="ts">
  import { createForm } from 'felte';
  import { navigate } from 'astro:transitions/client';
  import { client } from '../../api/client.ts';
  import { HTTPError, toastError } from '../errorHandling.ts';

  import Field from './Field.svelte';
  import Password from './Password.svelte';
  import Submit from './Submit.svelte';
  import Link from "./Link.svelte";
  import Toaster from '../Toaster.svelte';

  interface Credentials {
    email: string;
    password: string;
  }

  const { form } = createForm<Credentials>({
    onSubmit: async (body)  => {
      const { data: user, error } = await client.POST('/api/sessions', { body });
      if (error) throw new HTTPError(error);
      return user;
    },
    onSuccess: () => navigate('/'),
    onError: toastError,
  })
</script>

<form use:form class="flex flex-col gap-8 lg:px-8">
  <Field label="Email" name="email" type="email" />
  <Password />
  <Submit text="Log in" />
  <Link href="/sign-up" text="Don't have an account? Sign up!" />
</form>

<Toaster />
