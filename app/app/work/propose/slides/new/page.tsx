import { redirect } from "next/navigation";
import { workPaths } from "@/lib/work/paths";

export default function LegacySlideNewRedirect() {
  redirect(workPaths.propose);
}
