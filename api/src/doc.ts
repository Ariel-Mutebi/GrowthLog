/** Generate an OpenAPI document for the front-end client to consume */
import { writeFile } from 'node:fs/promises';
import { buildApp } from './app.js';

const app = buildApp();
const doc = app.swagger();
await writeFile('openapi.json', JSON.stringify(doc, null, 2));
