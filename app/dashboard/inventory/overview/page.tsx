import { redirect } from "next/navigation";

export default function InventoryRoutePage() {
  redirect("/dashboard/inventory?view=overview");
}
