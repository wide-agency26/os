import { redirect } from "next/navigation";

/** Legacy flat project list — Clients hub at /app/projects is canonical. */
export default function ProjectListRedirect() {
  redirect("/app/projects");
}
