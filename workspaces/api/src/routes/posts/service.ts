import * as Y from 'yjs';
import slugify from 'slugify';
import { randomInt } from 'node:crypto';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { generateHTML } from '@tiptap/html/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { PrismaClientKnownRequestError } from '@growthlog/db';

import type { Extensions, JSONContent } from '@tiptap/core';
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

interface UpdateParams {
  authorId: string;
  postId: string;
  title?: string;
  slug?: string;
}

export class PostService {
  private readonly extensions: Extensions;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cleaner: Cleaner,
    private readonly imageBaseUrl: string,
    private readonly imageBucket: string,
  ) {
    /*
     * Sync with web/src/components/write/Editor.svelte, including
     * only extensions and options to do with the document structure.
    */
    this.extensions = [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image,
    ];
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

  public async update(params: UpdateParams): Promise<PostMetadata> {
    const { authorId, postId, ...data } = params;

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
          return this.update(params);
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

  public async publishPost(authorId: string, postId: string, coverImageId?: string): Promise<PostMetadata> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId,
        deletedAt: null,
      },
      select: {
        title: true,
        slug: true,
        draftContent: true,
        images: {
          select: {
            imageId: true,
          },
        },
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

    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, post.draftContent);

    const json = TiptapTransformer.fromYdoc(ydoc, 'default');
    this.assertPublishable(json, postId);

    const publishedHtml = generateHTML(json, this.extensions);
    if (!coverImageId) coverImageId = post.images[0]?.imageId;

    const publishedPost = await this.prisma.post.update({
      where: {
        id: postId,
      },
      data: {
        publishedHtml,
        publishedSlug: post.slug,
        publishedTitle: post.title,
        publishedAt: new Date(),
        ...(coverImageId && { coverImageId }),
      },
      select: metadataSelector,
    });

    await this.cleaner.purgeUnusedImages({ postId });

    return publishedPost;
  }

  private async assertPublishable(doc: JSONContent, postId: string) {
    const srcPrefix = `${this.imageBaseUrl}/${this.imageBucket}/${postId}`;
    let hasContent = false;

    function visit(node: JSONContent) {
      if (node.type === 'image') {
        if (!String(node.attrs?.src).startsWith(srcPrefix)) {
          throw new InvalidImageError();
        }
        hasContent = true;
      } else if (node.type === 'text' && node.text?.trim()) {
        hasContent = true;
      }
      node.content?.forEach(visit);
    };

    visit(doc);
    if (!hasContent) throw new EmptyPostError();
  }
}
