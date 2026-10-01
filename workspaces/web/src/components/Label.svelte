<script lang="ts">
  interface Props {
    name: string;
    label: string;
    variant?: 'heavy' | 'light'; // visual weight
  }

  const { name, label, variant = 'heavy' }: Props = $props();
</script>

<label
  for={name}
  class={{
    'font-mono text-xl md:text-2xl text-stone-600 dark:text-stone-300 block': variant === 'heavy',
    'font-mono text-stone-400 dark:text-stone-300 text-sm sm:text-base': variant === 'light'
  }}
>
  {label}
</label>
