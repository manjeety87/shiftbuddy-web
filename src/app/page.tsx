import { redirect } from "next/navigation";

// The landing page will live here; until it exists, the address opens the app
export default function RootPage() {
  redirect("/home");
}
