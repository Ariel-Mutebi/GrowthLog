import { createContext } from 'svelte';
import type { Readable } from 'svelte/store';
import type { SignUpData, SignUpField } from './schema.ts';

type ErrorStore = Readable<Partial<Record<SignUpField, string[] | null>>>;

export const [getValidationErrors, setValidationErrors] = createContext<ErrorStore | null>();
export const [getSignUpData, setSignUpData] = createContext<Readable<SignUpData> | null>();
