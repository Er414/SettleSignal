import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, verifyAccessToken } from "./access-token";

export async function hasWorkspaceAccess(): Promise<boolean> {
  const jar = await cookies();
  return verifyAccessToken(jar.get(ACCESS_COOKIE)?.value);
}

export async function requireWorkspaceAccess(): Promise<void> {
  if (!(await hasWorkspaceAccess())) redirect("/access");
}
