<script lang="ts">
  interface Props {
    name: string;
    type?: string;
    padded?: boolean;
    variant?: 'regular' | 'header';
  }

  const {
    name,
    type = 'text',
    padded = true,
    variant = 'regular',
  }: Props = $props();
</script>

<input
  required
  type={type}
  name={name}
  id={name}
  class={[
    `text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-600
    focus:outline-hidden focus:border-stone-500 focus:dark:border-stone-300 w-full`,
    {
      'px-3 py-1.5': padded,
      'text-base md:text-xl': variant === 'regular',
      'text-2xl md:text-3xl': variant === 'header',
    }
  ]}
>
