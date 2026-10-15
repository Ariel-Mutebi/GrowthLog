<script lang="ts" module>
  import type { Action } from 'svelte/action';

  export const autoResize: Action<HTMLTextAreaElement, string | undefined> = (node) => {
    const resize = () => {
      node.style.height = 'auto';
      const styles = getComputedStyle(node);
      const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
      node.style.height = `${node.scrollHeight + border}px`;
    };

    resize();
    node.addEventListener('input', resize);
    window.addEventListener('resize', resize);

    return {
      update: resize,
      destroy() {
        node.removeEventListener('input', resize);
        window.removeEventListener('resize', resize);
      }
    };
  };
</script>

<script lang="ts">
  import Error from './Error.svelte';
  import FieldWrapper from './FieldWrapper.svelte';

  interface Props {
    name: string;
    rows?: number;
    extraClasses?: string;
    maximum?: number;
    errors: string[] | null;
  }

  const { name, extraClasses, rows = 1, maximum, errors }: Props = $props();
</script>

<FieldWrapper>
  <textarea
    {rows}
    id={name}
    name={name}
    use:autoResize
    class={[
      "text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-600",
      "focus:outline-hidden focus:border-stone-500 focus:dark:border-stone-300 w-full resize-none overflow-hidden",
      extraClasses,
    ]}
    maxlength={maximum}
  ></textarea>

  {#if errors}
    <Error {errors} />
  {/if}
</FieldWrapper>
