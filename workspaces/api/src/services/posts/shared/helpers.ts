import * as Y from 'yjs';
import type { JSONContent } from '@tiptap/core';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { InvalidImageError, EmptyPostError } from './errors.js';

export function yDocToJson(content: Uint8Array | null): JSONContent {
  if (!content) return {};
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, content);
  return TiptapTransformer.fromYdoc(ydoc, 'default');
}

/**
 * Assert that a ProseMirror JSON has content, and that all its images src
 * attributes start with the srcPrefix.
 */
export function assertPublishable(doc: JSONContent, srcPrefix: string) {
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

/**
 * Recursively extracts all the text within a ProseMirror node.
 */
function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return node.content?.map(textOf).join('') ?? '';
}

/**
 * Returns the first words within maxLength from the first paragraph.
 */
export function extractDefaultHook(doc: JSONContent, maxLength = 120): string {
  const p = doc.content?.find((node) => node.type === 'paragraph' && textOf(node).trim() !== '');
  if (!p) return '';

  const text = textOf(p).replace(/\s+/, ' ').trim();
  if (text.length < maxLength) return text;

  const cut = text.lastIndexOf(' ', maxLength);
  return text.slice(0, cut).trimEnd() + '…';
}
