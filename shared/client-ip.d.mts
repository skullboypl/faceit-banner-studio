export function clientIp(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  remoteAddress: string | undefined,
  hops?: number
): string;
