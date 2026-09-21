<script lang="ts">
  import Label from './Label.svelte';
  import Input from './Input.svelte';
  import Error from './Error.svelte';
  import FieldWrapper from './FieldWrapper.svelte';

  interface Props {
    label: string;
    name: string;
    type?: string;
    errors?: string[] | null;
  }

  const { name, label, errors, type = 'text' }: Props = $props();
</script>

<FieldWrapper>
  <Label {name} {label} />
  <Input {name} {type} />
  {#if errors}
    <Error {errors} />
  {/if}
</FieldWrapper>
