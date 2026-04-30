import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/retail-dispatch?view=packing-transporters");
}
