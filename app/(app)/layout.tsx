import { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AuthenticatedAppLayout({
  children
}: {
  children: ReactNode;
}) {
  return children;
}
