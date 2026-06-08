import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medium RAG Assistant",
  description: "RAG over ~7,682 Medium articles",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
