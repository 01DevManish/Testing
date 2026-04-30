import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/ecom-dispatch?view=create-dispatch");
}
