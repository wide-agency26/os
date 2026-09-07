import { revalidatePath } from "next/cache";
import { workPaths } from "@/lib/work/paths";

export function revalidateWork(opts?: {
  bdId?: string;
  sowId?: string;
  companyId?: string;
}) {
  revalidatePath("/app/work");
  revalidatePath("/app/home");
  if (opts?.bdId) {
    revalidatePath(workPaths.pipelineId(opts.bdId));
    revalidatePath(workPaths.qualifyId(opts.bdId));
    revalidatePath(workPaths.contractId(opts.bdId));
    revalidatePath(workPaths.quoteId(opts.bdId));
  }
  if (opts?.sowId) {
    revalidatePath(workPaths.sow);
    revalidatePath(workPaths.sowId(opts.sowId));
    revalidatePath(workPaths.sowPrint(opts.sowId));
  }
  if (opts?.companyId) {
    revalidatePath(workPaths.company(opts.companyId));
    revalidatePath(workPaths.wrap(opts.companyId));
  }
}
