export interface DraftFilters {
  orderBy: 'title' | 'updatedAt';
  order: 'asc' | 'desc';
  isPrivate: boolean;
  isPublished: boolean;
}
