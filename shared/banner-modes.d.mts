export const TEAM_LIMIT: number;
export function parseRoster(value: unknown): string[];
export function matchPhase(status: unknown): 'pre' | 'live' | 'post' | 'idle';
export function averageElo(players: { elo?: number }[]): number;
