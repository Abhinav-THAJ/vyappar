import { redirect } from "next/navigation";

/** Units live as a tab on the Items screen (ref-03). */
export default function ItemUnitsPage() {
  redirect("/items?tab=units");
}
