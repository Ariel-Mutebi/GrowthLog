/** Escape LIKE wildcards */
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');

/** Recursively trim strings in a JSON object */
export function trimStrings<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as T;
  }

  if (Array.isArray(value)) {
    return value.map(trimStrings) as T;
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        trimStrings(val),
      ]),
    ) as T;
  }

  return value;
}
