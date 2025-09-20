'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent
} from 'react';
import LogoutButton from './logout-button';
import { ThemeToggle } from '@syncal/ui';

type NavItem = {
  label: string;
  href: string;
  description: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    description: 'Overview of sync status and system health'
  },
  {
    label: 'Connectors',
    href: '/connectors',
    description: 'Manage provider connectors and setup wizards'
  },
  {
    label: 'Calendars',
    href: '/calendars',
    description: 'Review calendar pairs, privacy modes, and fallback order'
  },
  {
    label: 'Logs',
    href: '/logs',
    description: 'Inspect job history and application logs'
  },
  {
    label: 'Settings',
    href: '/settings',
    description: 'Configure alerts, appearance, and security policies'
  }
];

type NavLinkProps = {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
};

function isItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }

  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, isActive, onNavigate }: NavLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex flex-col rounded-lg border border-transparent px-4 py-3 text-sm transition hover:border-emerald-300 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:border-emerald-600/30 dark:hover:bg-emerald-900/20 ${
        isActive
          ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-100'
          : 'text-slate-600 dark:text-slate-300'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="text-sm font-semibold">{item.label}</span>
      <span className="mt-1 text-xs text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
        {item.description}
      </span>
    </Link>
  );
}

type MobileNavProps = {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  currentPath: string;
};

function MobileNavigation({ isOpen, onClose, items, currentPath }: MobileNavProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  const handleCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onClose();
    },
    [onClose]
  );

  const handleNavigate = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <dialog
      id="mobile-navigation"
      ref={dialogRef}
      className="mobile-nav-dialog rounded-t-3xl border border-slate-200/40 bg-white text-slate-900 shadow-xl backdrop:backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900 dark:text-slate-100"
      aria-label="Primary navigation"
      onCancel={handleCancel}
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">SynCal Portal</p>
          <h2 className="text-lg font-semibold">Navigate</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Close
        </button>
      </div>
      <nav aria-label="Primary" className="mt-4">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                isActive={isItemActive(currentPath, item.href)}
                onNavigate={handleNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        <LogoutButton
          className="space-y-2"
          buttonClassName="w-full justify-center rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        />
      </div>
    </dialog>
  );
}

function DesktopSidebar({ items, currentPath }: { items: NavItem[]; currentPath: string }) {
  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70 md:flex">
      <div className="flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">SynCal</p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Administration</h1>
        </div>
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-4 py-6">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} isActive={isItemActive(currentPath, item.href)} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <LogoutButton
          buttonClassName="w-full justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        />
      </div>
    </aside>
  );
}

function Header({ onOpenMobile, isMobileNavOpen }: { onOpenMobile: () => void; isMobileNavOpen: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md transition dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 md:hidden"
            aria-label="Open navigation"
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-navigation"
          >
            <span aria-hidden="true" className="block h-5 w-5">
              <span className="sr-only">Menu</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </span>
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">SynCal</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Portal Shell</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LogoutButton
            className="hidden sm:block"
            buttonClassName="inline-flex items-center rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const openMobileNav = useCallback(() => {
    setIsMobileNavOpen(true);
  }, []);

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  const navItems = useMemo(() => NAV_ITEMS, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="flex min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <DesktopSidebar items={navItems} currentPath={pathname ?? '/'} />
        <div className="flex flex-1 flex-col">
          <Header onOpenMobile={openMobileNav} isMobileNavOpen={isMobileNavOpen} />
          <main
            id="main-content"
            className="flex-1 px-4 py-6 sm:px-6 lg:px-10"
            role="main"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
      <MobileNavigation
        isOpen={isMobileNavOpen}
        onClose={closeMobileNav}
        items={navItems}
        currentPath={pathname ?? '/'}
      />
    </>
  );
}
