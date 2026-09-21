<script lang="ts">
  import zxcvbn from 'zxcvbn-ts';
  import type { SignUpData } from './schema.ts';

  const { forename, surname, email, password }: Partial<SignUpData> = $props();
  const filter = (string: string | undefined): string is string => string !== undefined;
  const data = $derived([forename, surname, email].filter(filter));
  const score = $derived( password ? zxcvbn(password, data).score : 0);
</script>

<ul class="flex gap-3 h-2" aria-label="Password strength (0 - 4): {score}">
  {#each Array(4) as _, index}
    <li class={[
      'grow border border-stone-200 dark:border-stone-600 rounded-md',
      { 'bg-orange-200 dark:bg-orange-900': index < score }
    ]}>
    </li>
  {/each}
</ul>
