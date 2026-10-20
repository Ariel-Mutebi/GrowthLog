<script lang="ts">
	import { TagsInput } from '$lib/components/ui/tags-input';
  import type { TagsInputProps } from '$lib/components/ui/tags-input/types';

  const validate: TagsInputProps['validate'] = (val, tags) => {
    const transformed = val.trim().toLocaleLowerCase();
    
    if (transformed.length === 0) return undefined;
    if (tags.find((t) => transformed === t.toLowerCase())) return undefined;
    
    return transformed;
  };
</script>

<TagsInput {validate} />