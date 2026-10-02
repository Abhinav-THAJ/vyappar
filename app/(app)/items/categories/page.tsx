import { redirect } from "next/navigation";

/** Categories live as a tab on the Items screen (ref-03). */
export default function ItemCategoriesPage() {
  redirect("/items?tab=categories");
}
