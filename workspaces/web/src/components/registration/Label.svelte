<script lang="ts">
  interface Props {
    name: string;
    label: string;
  }

  const { name, label }: Props = $props();
</script>

<label for={name} class="font-mono text-xl md:text-2xl text-stone-600 dark:text-stone-300 block">
  {label}
</label>
