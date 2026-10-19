import type { PrismaClient } from '@growthlog/db';

export interface TagSuggestion {
  id: string;
  name: string;
  postCount: number;
}

const SUGGESTION_LIMIT = 10;

export class TagService {
  constructor(private readonly prisma: PrismaClient) { }

  public async searchTags(input: string): Promise<TagSuggestion[]> {
    const query = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!query) return [];

    return this.prisma.$queryRaw<TagSuggestion[]>`
      SELECT
        t.id,
        t.name,
        COUNT(p.id)::int AS "postCount"
      FROM "Tag" t
      LEFT JOIN "_PostToTag" pt ON pt."B" = t.id
      LEFT JOIN "Post" p
        ON p.id = pt."A"
        AND p."publishedAt" IS NOT NULL
        AND p."deletedAt" IS NULL
      WHERE t.name ILIKE ${'%' + query + '%'}
      GROUP BY t.id
      ORDER BY
        CASE
          WHEN LOWER(t.name) = ${query} THEN 0
          WHEN t.name ILIKE ${query + '%'} THEN 1
          ELSE 2
        END,
        LENGTH(t.name) ASC,
        t.name ASC
      LIMIT ${SUGGESTION_LIMIT}
    `;
  }
}
