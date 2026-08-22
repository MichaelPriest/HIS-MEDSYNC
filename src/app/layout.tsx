import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/config/brand";
export const metadata: Metadata = { title: { default: brand.name, template: `%s | ${brand.shortName}` }, description: brand.description };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
