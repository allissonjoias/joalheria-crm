import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
};
