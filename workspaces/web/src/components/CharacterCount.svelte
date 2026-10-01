<script lang="ts">
  interface Props {
    current: number;
    maximum: number;
  }

  const { current, maximum }: Props = $props();
</script>

<p class="text-stone-400 text-sm md:text-base font-mono">
  {current}/{maximum}
  <span class="hidden md:inline">characters</span>
</p>
