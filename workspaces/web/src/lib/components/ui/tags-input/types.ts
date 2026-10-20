import type { HTMLInputAttributes } from 'svelte/elements';

export type TagSuggestion = {
	name: string;
	postCount: number;
}

export type TagsInputPropsWithoutHTML = {
	value?: string[];
	validate?: (val: string, tags: string[]) => string | undefined;
	onValueChange?: (value: string[]) => void;
	suggestions?: TagSuggestion[];
	filterSuggestions?: (inputValue: string, suggestions: TagSuggestion[]) => TagSuggestion[];
	restrictToSuggestions?: boolean;
};

export type TagsInputProps = TagsInputPropsWithoutHTML & Omit<HTMLInputAttributes, 'value'>;
