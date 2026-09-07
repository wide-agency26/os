import { redirect } from "next/navigation";
import { workPaths } from "@/lib/work/paths";

export default function WorkLoseRedirect() {
  redirect(`${workPaths.archived}?filter=lose`);
}
