import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Point Prisma at the schema FOLDER so it merges ./enums and ./models.
  schema: 'prisma/',
});
