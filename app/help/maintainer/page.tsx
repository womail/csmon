import { redirect } from "next/navigation";

/** Legacy URL — manual is one document with maintainer sections. */
export default function MaintainerRedirect() {
  redirect("/help#maintainer-code");
}
