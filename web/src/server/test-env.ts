/** Local-only defaults for tests: the throwaway databases from docker-compose.dev.yml. */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres:dev@127.0.0.1:5434/faceitbanner_test';
export const TEST_REDIS_URL = process.env.REDIS_URL_TEST ?? 'redis://:dev@127.0.0.1:6381/15';
