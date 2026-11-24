import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { EventStore, type EventState } from '../lib/eventStore.ts';

/** The store for an event id, started while the component is mounted. */
export function useEventStore(
  id: string,
  admin: string | null,
  onAdminLost: () => void
): {
  store: EventStore;
  state: EventState;
} {
  const store = useMemo(
    () => new EventStore(id, admin, onAdminLost),
    [id, admin, onAdminLost]
  );
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { store, state };
}
