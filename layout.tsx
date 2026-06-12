"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

const NAV_ITEMS = [
  { href: "/",          label: "Home",           icon: "🏠" },
  { href: "/chat",      label: "Chat Workspace",  icon: "💬" },
  { href: "/documents", label: "Documents",       icon: "📄" },
  { href: "/analytics", label: "Analytics",       icon: "📊" },
  { href: "/settings",  label: "Settings",        icon: "⚙️"  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0B0C14] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {pathname !== "/chat" && (
          <nav className="flex items-center gap-1 px-6 py-3 border-b border-slate-800/80 bg-[#0F1019]/90 backdrop-blur sticky top-0 z-50">
            <div className="flex items-center gap-2 mr-6">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs shadow-lg shadow-indigo-500/30">✦</div>
              <span className="text-sm font-bold text-white">RAGForge</span>
            </div>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  pathname === item.href
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}