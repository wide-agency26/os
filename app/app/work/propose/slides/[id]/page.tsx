import { redirect } from "next/navigation";
import { workPaths } from "@/lib/work/paths";

export default function LegacySlideRedirect() {
  redirect(workPaths.propose);
}
