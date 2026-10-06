import { router, ownerOnlyProcedure } from "../_core/trpc.js";
import {
  getCapabilityProviderState,
  listCapabilitySecurityIncidents,
} from "../capabilities/store.js";

export const capabilitySecurityRouter = router({
  incidents: ownerOnlyProcedure.query(async () => {
    const [incidents, providerState] = await Promise.all([
      listCapabilitySecurityIncidents(100),
      getCapabilityProviderState("composio"),
    ]);

    return {
      providerState,
      incidents: incidents.map((incident) => ({
        id: incident.id,
        createdAt: incident.createdAt,
        details: incident.details,
      })),
    };
  }),
});
