export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getWeekNumber } from "@/lib/displayNames";

export default function BemanningslisteRedirectPage() {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now).toString().padStart(2, "0");

  redirect(`/admin/bemanningsliste/${year}/${week}`);
}
