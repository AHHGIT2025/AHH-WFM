import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connection_limit=')) {
  const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${sep}connection_limit=5`;
}
