import { buildApp } from '../src/app.js';
import { writeFile } from 'node:fs/promises';
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript';

const app = buildApp();
await app.ready();

const doc = app.swagger();
const ast = await openapiTS(doc as object as OpenAPI3);
await writeFile(new URL('./schema.d.ts', import.meta.url), astToString(ast));

await app.close();
