import { redirect } from "next/navigation";

/**
 * The root is a signpost, not a page.
 *
 * It used to be the CCN experience itself — one hardwired star, one database.
 * There is no longer a single experience to land on: a participant arrives at
 * `/e/[slug]` by a link they were given, and everyone else is here to manage
 * projects. `/projects` sends them on to sign in if they are not.
 */
export default function RootPage() {
  redirect("/projects");
}
