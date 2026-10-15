<script lang="ts">
  import CharacterCount from './CharacterCount.svelte';
  import FieldWrapper from './FieldWrapper.svelte';
  import Label from './Label.svelte';
  import Textarea from './Textarea.svelte';

  interface Props {
    name: string;
    label: string;
    rows: number;
    current: number;
    maximum: number;
    errors: string[] | null;
  }

  const { name, label, rows, current, maximum, errors }: Props = $props();
</script>

<FieldWrapper>
  <div class="flex justify-between">
    <Label {name} {label} variant="light" />
    {#if current}
      <CharacterCount {current} {maximum} />
    {/if}
  </div>
  <Textarea {name} {rows} {errors} />
</FieldWrapper>
