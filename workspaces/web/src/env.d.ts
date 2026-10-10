import '../.astro/types.d.ts';
import 'astro/client';
import type { User } from './types/backend.ts';

declare global {
  namespace App {
    interface Locals {
      user?: User;
    }
  }
}
