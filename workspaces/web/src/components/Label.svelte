<script lang="ts">
  interface Props {
    label: string;
    name?: string;
    id?: string;
    variant?: 'heavy' | 'light'; // visual weight
  }

  const { name, label, id, variant = 'heavy' }: Props = $props();
</script>

<label
  id={id}
  for={name}
  class={{
    'font-mono text-xl md:text-2xl text-stone-600 dark:text-stone-300 block': variant === 'heavy',
    'font-mono text-stone-500 dark:text-stone-300 text-sm sm:text-base': variant === 'light'
  }}
>
  {label}
</label>
