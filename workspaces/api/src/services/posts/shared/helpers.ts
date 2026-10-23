import * as Y from 'yjs';
import type { JSONContent } from '@tiptap/core';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { InvalidImageError, EmptyPostError } from './errors.js';

const WORDS_PER_MINUTE = 238;

export function yDocToJson(content: Uint8Array | null): JSONContent {
  if (!content) return {};
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, content);
  return TiptapTransformer.fromYdoc(ydoc, 'default');
}

export function assertPublishable(doc: JSONContent, srcPrefix: string) {
  let hasContent = false;

  function visit(node: JSONContent) {
    if (node.type === 'image') {
      if (!isOwnImage(node.attrs?.src, srcPrefix)) {
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

function isOwnImage(src: unknown, srcPrefix: string): boolean {
  if (typeof src !== 'string') return false;
  try {
    const url = new URL(src);
    const base = new URL(`${srcPrefix}/`);
    return url.origin === base.origin && url.pathname.startsWith(base.pathname) && url.href === src;
  } catch {
    return false;
  }
}

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  const inline = node.content?.every((c) => c.type === 'text' || c.type === 'hardBreak');
  return node.content?.map(textOf).join(inline ? '' : ' ') ?? '';
}

export function extractDefaultHook(doc: JSONContent, maxLength = 120): string {
  const p = doc.content?.find((node) => node.type === 'paragraph' && textOf(node).trim() !== '');
  if (!p) return '';

  const text = textOf(p).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;

  const cut = text.lastIndexOf(' ', maxLength);
  return text.slice(0, cut > 0 ? cut : maxLength).trimEnd() + '…';
}

export function readingTimeMinutes(doc: JSONContent): number {
  const words = textOf(doc).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
