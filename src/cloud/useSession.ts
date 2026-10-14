import { useCallback, useEffect, useState } from 'react';
import { fetchMe, type User } from './api';

export type Session = { user: User | null; admin: boolean; loading: boolean; refresh: () => void };

export function useSession(): Session {
  const [state, setState] = useState<{ user: User | null; admin: boolean; loading: boolean }>({
    user: null,
    admin: false,
    loading: true,
  });

  const refresh = useCallback(() => {
    fetchMe()
      .then(({ user, admin }) => setState({ user, admin, loading: false }))
      .catch(() => setState({ user: null, admin: false, loading: false }));
  }, []);

  useEffect(refresh, [refresh]);
  return { ...state, refresh };
}
