import { redirect } from "next/navigation";

export default function CrmUsersRedirect() {
  redirect("/app/crm/access");
}
