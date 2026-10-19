import slugify from 'slugify';
import { randomInt } from 'node:crypto';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { generateHTML } from '@tiptap/html/server';
import { PrismaClientKnownRequestError } from '@growthlog/db';
import {
  PostNotFoundError,
  SlugConflictError,
  TitleRequiredError,
  EmptyPostError,
  InvalidCoverImageError,
} from './shared/errors.js';
import { yDocToJson, assertPublishable, extractDefaultHook, readingTimeMinutes } from './shared/helpers.js';

import type { Extensions } from '@tiptap/core';
import type { Cleaner } from '@growthlog/jobs';
import type { PrismaClient } from '@growthlog/db';

export interface PublishSnapshot {
  slug: string;
  tags: string[];
  coverImageId: string;
  publishedTitle: string;
  publishedHook: string;
}

export interface PrePublishDefaults {
  slug: string;
  publishedTitle: string;
  publishedHook: string;
  coverImageId: string | null;
  coverImageKey: string | null;
}

export class PublishService {
  private readonly prisma: PrismaClient;
  private readonly cleaner: Cleaner;
  private readonly srcPrefix: string;
  private readonly extensions: Extensions;

  constructor(
    prisma: PrismaClient,
    cleaner: Cleaner,
    storageEndpoint: string,
    imageBucket: string,
  ) {
    this.prisma = prisma;
    this.cleaner = cleaner;
    this.srcPrefix = `${storageEndpoint}/${imageBucket}`;

    // Sync structural extensions and options with Editor.svelte
    this.extensions = [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image,
    ];
  }

  public async publish(authorId: string, postId: string, snapshot: PublishSnapshot) {
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

    await this.assertCoverImageValid(postId, snapshot.coverImageId);

    const json = yDocToJson(post.draftContent);
    assertPublishable(json, `${this.srcPrefix}/${postId}`);

    const publishedHtml = generateHTML(json, this.extensions);
    const readingTime = readingTimeMinutes(json);
    const publishedPost = this.publishPost({ postId, publishedHtml, readingTime, snapshot });

    await this.cleaner.purgeUnusedImages({ postId });
    return publishedPost;
  }

  private async publishPost(params: {
    postId: string;
    publishedHtml: string;
    readingTime: number;
    snapshot: PublishSnapshot;
  }) {
    const { postId, publishedHtml, readingTime, snapshot } = params;
    const { slug, publishedTitle, coverImageId, publishedHook, tags } = snapshot;

    try {
      await this.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          slug,
          title: publishedTitle,
          publishedHtml,
          publishedTitle,
          publishedHook,
          coverImageId,
          readingTime,
          publishedAt: new Date(),
          tags: {
            connectOrCreate: tags.map((name) => ({
              where: { name },
              create: { name },
            })),
          },
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SlugConflictError();
      }

      throw error;
    }
  }

  private async assertCoverImageValid(postId: string, imageId: string) {
    const postImage = await this.prisma.postImage.findFirst({
      where: {
        imageId,
        postId,
        image: {
          status: 'UPLOADED',
        },
      },
      select: { imageId: true },
    });

    if (!postImage) throw new InvalidCoverImageError();
  }

  public async prepublish(authorId: string, id: string): Promise<PrePublishDefaults> {
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        authorId,
      },
      select: {
        title: true,
        draftContent: true,
        images: {
          select: {
            imageId: true,
            image: {
              select: {
                key: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!post) throw new PostNotFoundError();

    const json = yDocToJson(post.draftContent);
    const defaultCover = post.images.find((postImage) => postImage.image.status === 'UPLOADED');

    return {
      slug: `${slugify(post.title, { lower: true })}-${randomInt(1000, 10000)}`,
      publishedTitle: post.title,
      publishedHook: extractDefaultHook(json),
      coverImageId: defaultCover ? defaultCover.imageId : null,
      coverImageKey: defaultCover ? defaultCover.image.key : null,
    };
  }

  public async unpublish(authorId: string, id: string) {
    try {
      await this.prisma.post.update({
        where: {
          authorId,
          id,
        },
        data: {
          publishedAt: null,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }

      throw error;
    }
  }
}
