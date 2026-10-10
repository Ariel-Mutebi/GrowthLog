export interface DraftFilters {
  sortBy: 'title' | 'updatedAt';
  order: 'asc' | 'desc';
  isPrivate: boolean;
  isPublished: boolean;
}
