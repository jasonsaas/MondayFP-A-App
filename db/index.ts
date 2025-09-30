import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as auth from "./schema/auth";
import * as fpa from "./schema/fpa";

export const db = drizzle(process.env.DATABASE_URL!, { schema: { ...auth, ...fpa } });