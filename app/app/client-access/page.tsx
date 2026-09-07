import { redirect } from "next/navigation";

export default function ClientAccessRedirect() {
  redirect("/app/crm/access");
}
