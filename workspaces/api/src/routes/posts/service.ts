import slugify from 'slugify';
import { randomInt } from 'node:crypto';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { generateHTML } from '@tiptap/html/server';
import { PrismaClientKnownRequestError } from '@growthlog/db';
import { assertPublishable, extractDefaultHook, yDocToJson } from './explorers.js';

import type { Extensions } from '@tiptap/core';
import type {
  PostSelect,
  PostWhereInput,
  PrismaClient,
} from '@growthlog/db';
import type { Cleaner } from '@growthlog/jobs';
import type { PostMetadata, PostQueryOptions } from './schema.js';

export class PostNotFoundError extends Error { };
export class SlugConflictError extends Error { };
export class TitleRequiredError extends Error { };
export class EmptyPostError extends Error { };
export class InvalidImageError extends Error { };

const metadataSelector = {
  id: true,
  authorId: true,
  title: true,
  slug: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  coverImageId: true,
  publishedSlug: true,
  publishedTitle: true,
} satisfies PostSelect;

interface UpdateData {
  title?: string;
  slug?: string;
}

interface PublishAdditions {
  coverImageId: string;
  publishedSlug: string;
  publishedTitle: string;
  publishedHook: string;
}

interface PrePublishDefaults {
  publishedSlug: string;
  publishedTitle: string;
  publishedHook: string;
  coverImageId: string | null;
  coverImageKey: string | null;
};

export class PostService {
  private readonly extensions: Extensions;
  private readonly srcPrefix: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cleaner: Cleaner,
    imageBaseUrl: string,
    imageBucket: string,
  ) {
    /*
     * Sync with web/src/components/write/Editor.svelte, including
     * only extensions and options to do with the document structure.
    */
    this.extensions = [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image,
    ];
    this.srcPrefix = `/${imageBaseUrl}/${imageBucket}`;
  }

  public async create(authorId: string): Promise<PostMetadata> {
    return await this.prisma.post.create({
      data: {
        authorId,
        title: 'Untitled',
        slug: `untitled-${randomInt(1000, 10000)}`,
      },
      select: metadataSelector,
    });
  }

  public async update(authorId: string, postId: string, data: UpdateData): Promise<PostMetadata> {
    try {
      return await this.prisma.post.update({
        where: {
          authorId,
          id: postId,
        },
        data: {
          ...data,
          ...(data.title && !data.slug ?
                { slug: `${slugify(data.title, { lower: true })}-${randomInt(1000, 10000)}` } : {}),
        },
        select: metadataSelector,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PostNotFoundError();
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        if (data.title && !data.slug) {
          return this.update(authorId, postId, data);
        }
        throw new SlugConflictError();
      }

      throw error;
    }
  }

  public async getPost(authorId: string, slug: string): Promise<PostMetadata> {
    try {
      return await this.prisma.post.findUniqueOrThrow({
        where: {
          authorId,
          slug,
        },
        select: metadataSelector,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PostNotFoundError();
      }

      throw error;
    }
  }

  public async getPosts(authorId: string, options: PostQueryOptions): Promise<PostMetadata[]> {
    const { sortBy = 'updatedAt', order = 'asc', published } = options;

    const where: PostWhereInput = { authorId };

    if (published !== undefined) {
      where.publishedAt = published ? { not: null } : null;
    }

    return await this.prisma.post.findMany({
      where,
      select: metadataSelector,
      orderBy: [{ [sortBy]: order }],
    });
  }

  public async publishPost(authorId: string, postId: string, additions: PublishAdditions): Promise<PostMetadata> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId,
        deletedAt: null,
      },
      select: {
        title: true,
        draftContent: true,
      },
    });

    if (!post) {
      throw new PostNotFoundError();
    }

    if (!post.title.trim() || post.title === 'Untitled') {
      throw new TitleRequiredError();
    }

    if (!post.draftContent) {
      throw new EmptyPostError();
    }

    const json = yDocToJson(post.draftContent);
    assertPublishable(json, `${this.srcPrefix}/${postId}`);

    const publishedHtml = generateHTML(json, this.extensions);
    const { publishedSlug, publishedTitle, coverImageId } = additions;

    try {
      const publishedPost = await this.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          slug: publishedSlug,
          title: publishedTitle,
          publishedHtml,
          publishedSlug,
          publishedTitle,
          publishedAt: new Date(),
          ...(coverImageId && { coverImageId }),
        },
        select: metadataSelector,
      });

      await this.cleaner.purgeUnusedImages({ postId });

      return publishedPost;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SlugConflictError();
      }

      throw error;
    }
  }

  public async prepublish(authorId: string, postId: string): Promise<PrePublishDefaults> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId,
      },
      select: {
        slug: true,
        title: true,
        draftContent: true,
        images: {
          select: {
            imageId: true,
            key: true,
          },
        },
      },
    });

    if (!post) throw new PostNotFoundError();
    const defaultCover = post.images[0];
    const json = yDocToJson(post.draftContent);

    return {
      publishedSlug: post.slug,
      publishedTitle: post.title,
      publishedHook: extractDefaultHook(json),
      coverImageKey: defaultCover ? defaultCover.key : null,
      coverImageId: defaultCover ? defaultCover.imageId : null,
    };
  }
}
