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
import { yDocToJson, assertPublishable, extractDefaultHook } from './shared/helpers.js';

import type { Extensions } from '@tiptap/core';
import type { Cleaner } from '@growthlog/jobs';
import type { PrismaClient } from '@growthlog/db';

export interface PublishSnapshot {
  slug: string;
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

    const json = yDocToJson(post.draftContent);
    assertPublishable(json, `${this.srcPrefix}/${postId}`);

    const publishedHtml = generateHTML(json, this.extensions);
    const publishedPost = this.publishPost(postId, publishedHtml, snapshot);

    await this.cleaner.purgeUnusedImages({ postId });
    return publishedPost;
  }

  private async publishPost(postId: string, publishedHtml: string, snapshot: PublishSnapshot) {
    const { slug, publishedTitle, coverImageId, publishedHook } = snapshot;
    await this.assertCoverImageValid(postId, coverImageId);

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
          publishedAt: new Date(),
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
        slug: true,
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
      slug: post.slug,
      publishedTitle: post.title,
      publishedHook: extractDefaultHook(json),
      coverImageId: defaultCover ? defaultCover.imageId : null,
      coverImageKey: defaultCover ? defaultCover.image.key : null,
    };
  }
}
