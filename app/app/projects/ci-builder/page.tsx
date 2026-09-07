import { redirect } from "next/navigation";
import { workPaths } from "@/lib/work/paths";

export default function LegacyCiHub() {
  redirect(workPaths.toolsCi);
}
