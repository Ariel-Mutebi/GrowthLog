import { createContext } from 'svelte';
import type { Readable } from 'svelte/store';
import type { SignUpData, SignUpField } from './schema.ts';

type ErrorStore = Readable<Partial<Record<SignUpField, string[] | null>>>;

export const [getValidationErrors, setValidationErrors] = createContext<ErrorStore>();
export const [getSignUpData, setSignUpData] = createContext<Readable<SignUpData>>();
