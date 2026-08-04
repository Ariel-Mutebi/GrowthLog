<script lang="ts">
  import z from 'zod';
  import zxcvbn from 'zxcvbn-ts';
  import { createForm } from 'felte';
  import { validator } from '@felte/validator-zod';
  import SignUpField from './sign-up/SignUpField.svelte';

  const schema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }).superRefine(({ firstName, lastName, email, password }, context) => {
    const test = zxcvbn(password, [firstName, lastName, email].filter(Boolean));

    if (test.score < 3) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: test.feedback.warning || 'This password is too weak',
      });
    }
  });

  const { form, errors } = createForm({
    extend: validator({ schema }),
  });
</script>

<form use:form class="flex justify-center items-center grow">
  <div class="flex flex-col w-xl px-6 gap-5 h-max">
    <div class="flex gap-4 w-full">
      <SignUpField field="First name" />
      <SignUpField field="Last name" />
    </div>

    <SignUpField field="Email" type="email" />
    <SignUpField field="Password" type="password" />
    
    <button
      type="submit"
      class="p-2 rounded-lg text-white text-xl bg-linear-to-r from-black/60 to-black"
    >
      Sign up
    </button>
  </div>
</form>
