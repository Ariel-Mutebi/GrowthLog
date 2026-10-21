/** Escape LIKE wildcards */
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');
