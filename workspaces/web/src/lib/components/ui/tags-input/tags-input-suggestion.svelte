<script lang="ts">
	type Props = {
		id: string;
		value: string;
		postCount: number;
		active: boolean;
		onSelect: (value: string) => void;
	};

	let { id, value, postCount, active, onSelect }: Props = $props();
</script>

<button
	{id}
	type="button"
	role="option"
	aria-selected={active}
	class="hover:bg-accent aria-selected:bg-accent flex w-full cursor-default items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden transition-colors select-none"
	onmousedown={(e) => {
		e.preventDefault();
		onSelect(value);
	}}
>
	<span>{value}</span>
	<span class="text-muted-foreground text-xs tabular-nums">
		{postCount}
	</span>
</button>
