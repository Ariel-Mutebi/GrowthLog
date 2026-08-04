import { createContext } from 'svelte';
import type { Readable } from 'svelte/store';
import type { SignUpField } from './schema.ts';

type ErrorStore = Readable<Partial<Record<SignUpField, string[]>>>;

export const [getValidationErrors, setValidationErrors] = createContext<ErrorStore>();
