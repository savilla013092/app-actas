'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  LucideBox,
  LucideChevronRight,
  LucideClipboardList,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideMenu,
  LucideUsers,
  LucideX,
} from 'lucide-react';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LucideLayoutDashboard,
    roles: ['admin', 'logistica', 'custodio'],
  },
  {
    label: 'Préstamo Express',
    href: '/express-loans',
    icon: LucideBox,
    roles: ['admin', 'logistica'],
  },
  {
    label: 'Activos',
    href: '/activos',
    icon: LucideBox,
    roles: ['admin', 'logistica', 'custodio'],
  },
  {
    label: 'Revisiones',
    href: '/revision',
    icon: LucideClipboardList,
    roles: ['admin', 'logistica', 'custodio'],
  },
  {
    label: 'Usuarios',
    href: '/admin/usuarios',
    icon: LucideUsers,
    roles: ['admin'],
  },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/activos': 'Inventario de activos',
  '/revision': 'Revisiones',
  '/admin/usuarios': 'Gestión de usuarios',
  '/admin/importar': 'Importar datos',
  '/express-loans': 'Préstamo express',
  '/express-loans/new': 'Nuevo préstamo express',
  '/asignaciones': 'Asignaciones iniciales',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth/login');
  };

  const filteredNavItems = navItems.filter((item) => !item.roles || (role ? item.roles.includes(role) : false));
  const currentPageTitle = pathname.startsWith('/asignaciones')
    ? pageTitles['/asignaciones']
    : pageTitles[pathname] || 'Sistema de Actas';

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <AuthGuard>
      <div className='flex min-h-screen bg-background text-foreground'>
        <button
          className='fixed bottom-4 right-4 z-50 rounded-full bg-primary p-4 text-white shadow-elegant-xl transition-all duration-200 hover:scale-105 hover:shadow-lg lg:hidden'
          onClick={() => setIsSidebarOpen((current) => !current)}
        >
          {isSidebarOpen ? <LucideX size={20} /> : <LucideMenu size={20} />}
        </button>

        {isSidebarOpen ? (
          <div className='fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden' onClick={() => setIsSidebarOpen(false)} />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-border glass-strong shadow-elegant-xl transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : ''
          }`}
        >
          <div className='border-b border-border/50 p-6'>
            <Link href='/dashboard' className='group flex items-center gap-3'>
              <div className='relative h-12 w-12 overflow-hidden rounded-xl ring-2 ring-primary/20 shadow-md transition-all duration-200 group-hover:ring-primary/40'>
                <Image src='/logo-serviciudad.png' alt='SERVICIUDAD ESP' fill className='object-cover' />
              </div>
              <div className='min-w-0 flex-1'>
                <h2 className='text-sm font-bold leading-tight text-foreground'>SERVICIUDAD</h2>
                <p className='text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>Activos fijos</p>
              </div>
            </Link>
          </div>

          <nav className='flex-1 space-y-1.5 overflow-y-auto p-4'>
            <p className='px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>Navegación</p>
            {filteredNavItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon
                    size={20}
                    className={
                      isActive
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground transition-colors group-hover:text-foreground'
                    }
                  />
                  <span className='flex-1'>{item.label}</span>
                  {isActive ? <LucideChevronRight size={16} className='text-primary-foreground/70' /> : null}
                </Link>
              );
            })}
          </nav>

          <div className='border-t border-border/50 bg-muted/30 p-4'>
            <div className='mb-3 flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-white shadow-md'>
                {user?.usuario?.nombre ? user.usuario.nombre.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-semibold text-foreground'>{user?.usuario?.nombre || 'Usuario'}</p>
                <p className='text-xs font-medium capitalize text-muted-foreground'>{role || 'Sin rol'}</p>
              </div>
            </div>
            <Button
              variant='outline'
              className='w-full justify-center gap-2 border-border/50 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
              onClick={handleLogout}
            >
              <LucideLogOut size={18} />
              <span>Cerrar sesión</span>
            </Button>
          </div>
        </aside>

        <main className='flex min-w-0 flex-1 flex-col overflow-hidden'>
          <header className='sticky top-0 z-20 flex h-16 items-center border-b border-border/50 glass px-6 lg:px-10'>
            <div className='flex items-center gap-3'>
              <div className='hidden h-8 w-8 items-center justify-center rounded-lg bg-primary/10 lg:flex'>
                <LucideLayoutDashboard className='h-4 w-4 text-primary' />
              </div>
              <div>
                <h1 className='text-lg font-bold text-foreground'>{currentPageTitle}</h1>
                <p className='hidden text-[10px] uppercase tracking-wider text-muted-foreground lg:block'>SERVICIUDAD ESP</p>
              </div>
            </div>
          </header>

          <div className='flex-1 overflow-auto p-6 lg:p-10'>{children}</div>
          <Footer compact />
        </main>
      </div>
    </AuthGuard>
  );
}
