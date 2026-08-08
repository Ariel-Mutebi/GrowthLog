/**
 * Workaround: ajv-formats@3.0.1's .d.ts doesn't resolve correctly under nodenext + "type": "module",
 * making its default export uncallable. See https://github.com/ajv-validator/ajv-formats/issues/85
 */

declare module 'ajv-formats' {
  import type { Ajv } from 'ajv';

  export type FormatName =
    | 'date' | 'time' | 'date-time' | 'duration' | 'uri' | 'uri-reference'
    | 'uri-template' | 'url' | 'email' | 'hostname' | 'ipv4' | 'ipv6'
    | 'regex' | 'uuid' | 'json-pointer' | 'json-pointer-uri-fragment'
    | 'relative-json-pointer' | 'byte' | 'int32' | 'int64' | 'float' | 'double'
    | 'password' | 'binary';

  export interface FormatOptions {
    mode?: 'fast' | 'full';
    formats?: FormatName[];
    keywords?: boolean;
  }

  export type FormatsPluginOptions = FormatName[] | FormatOptions;

  export default function addFormats(
    ajv: Ajv,
    options?: FormatsPluginOptions
  ): Ajv;
}
