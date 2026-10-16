import { protectedProcedure, router } from "../_core/trpc.js";
import { buildCustomerDataExport } from "../lib/customerDataExport.js";

export const accountRouter = router({
  exportData: protectedProcedure.query(({ ctx }) => {
    return buildCustomerDataExport(ctx.user.id);
  }),
});
