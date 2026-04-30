import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/retail-dispatch?view=create-packing-list");
}
