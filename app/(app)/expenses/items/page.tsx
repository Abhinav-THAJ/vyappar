import { redirect } from "next/navigation";

/**
 * The reference has an ITEMS tab beside CATEGORY on Expenses. Expense items are
 * not modelled separately here — an itemised expense uses ordinary items — so
 * this redirects rather than showing an empty screen.
 */
export default function ExpenseItemsPage() {
  redirect("/expenses");
}
