import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Storybook (working name)",
  description:
    "Parent-authored, AI-assisted personalized children's storybooks, exported as print-ready booklets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#F4F1EA",
          color: "#2b2b2b",
        }}
      >
        {children}
      </body>
    </html>
  );
}
