import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  PUBLIC_BASE_PATH: z.string().default('/painel/v27'),

  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  USE_MOCK_CONNECTORS: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
