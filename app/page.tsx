import { redirect } from "next/navigation";

export default function RootPage() {
  // The middleware sends signed-out users to /login; everyone else picks a company.
  redirect("/companies");
}
