import { writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/utils/config.js';
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript';

loadEnv();
const app = buildApp();
await app.ready();

const doc = app.swagger();
const ast = await openapiTS(doc as object as OpenAPI3);
const contents = astToString(ast);

await writeFile(new URL('./schema.d.ts', import.meta.url), contents);

await app.close();
process.exit(0);
