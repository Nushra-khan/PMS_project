import type { Metadata } from "next";
import { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "PMS Pro",
  description:
    "Performance and goal management platform for probation, review cycles, and goal workflows."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
