'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderTree, Copy, ShieldCheck, History,
  HardDrive, BarChart3, AppWindow, Code2, Gamepad2, TrendingUp, FileText, Settings
} from 'lucide-react';

export default function SidebarNav() {
  const pathname = usePathname();
  const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'File Explorer', href: '/explorer', icon: FolderTree },
    { name: 'File Types', href: '/types', icon: BarChart3 },
    { name: 'Applications', href: '/apps', icon: AppWindow },
    { name: 'Developer Storage', href: '/developer', icon: Code2 },
    { name: 'Gaming Storage', href: '/games', icon: Gamepad2 },
    { name: 'Duplicates', href: '/duplicates', icon: Copy },
    { name: 'Cleanup Center', href: '/recommendations', icon: ShieldCheck },
    { name: 'Trends & Forecasts', href: '/trends', icon: TrendingUp },
    { name: 'AI Reports', href: '/reports', icon: FileText },
    { name: 'Execution History', href: '/history', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside style={{ width: 220, minHeight: '100vh', background: '#0A1628', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
        <HardDrive size={22} color="#6366f1" />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: 1 }}>DISKMIND</span>
      </div>
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 8, marginBottom: 2, textDecoration: 'none',
                color: isActive ? '#fff' : '#94a3b8',
                background: isActive ? 'linear-gradient(135deg, #6366f1, #3b82f6)' : 'transparent',
                fontWeight: isActive ? 600 : 400, fontSize: 14, transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}