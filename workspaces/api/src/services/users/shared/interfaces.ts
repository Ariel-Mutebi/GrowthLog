export interface Editable {
  forename: string;
  surname: string;
  username?: string;
  bio?: string;
  email: string;
  password: string;
}

export interface PublicUser {
  id: string;
  forename: string;
  surname: string;
  username: string;
  createdAt: Date;
  bio: string | null;
}

export interface Personal extends PublicUser {
  email: string;
}

export interface IdentityProof {
  passwordAttempt: string;
}

export interface SearchParams {
  name: string;
  cursor: string;
  limit: number;
  interests: string[];
}

export interface SearchResult {
  users: PublicUser[];
  nextCursor: string | null;
}
