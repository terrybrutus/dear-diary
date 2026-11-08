import { createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";

/**
 * Confirms the backend canister is reachable by calling a base
 * authorization method exposed by the generated bindings.
 */
export function useBackendReachable() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["backend", "reachable"],
    queryFn: async () => {
      if (!actor) return false;
      await actor.getCallerUserRole();
      return true;
    },
    enabled: !!actor && !isFetching,
    retry: 1,
  });
}
