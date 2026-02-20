'use client';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    LucideLayoutDashboard,
    LucideClipboardList,
    LucideBox,
    LucideUsers,
    LucideLogOut,
    LucideMenu,
    LucideX,
    LucideChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { 
        label: 'Dashboard', 
        href: '/dashboard', 
        icon: LucideLayoutDashboard, 
        roles: ['admin', 'logistica', 'custodio'],
        description: 'Resumen general'
    },
    { 
        label: 'Préstamo Express',
        href: '/express-loans',
        icon: LucideBox,
        roles: ['admin', 'logistica', 'custodio'],
        description: 'Registro de entrega funcional'
    },
    {
        label: 'Activos', 
        href: '/activos', 
        icon: LucideBox, 
        roles: ['admin', 'logistica', 'custodio'],
        description: 'Inventario de activos'
    },
    { 
        label: 'Revisiones', 
        href: '/revision', 
        icon: LucideClipboardList, 
        roles: ['admin', 'logistica'],
        description: 'Historial de revisiones'
    },
    { 
        label: 'Usuarios', 
        href: '/admin/usuarios', 
        icon: LucideUsers, 
        roles: ['admin'],
        description: 'GestiÃ³n de usuarios'
    },
];

const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/activos': 'Inventario de Activos',
    '/revision': 'Revisiones',
    '/admin/usuarios': 'GestiÃ³n de Usuarios',
    '/admin/importar': 'Importar Datos',
    '/express-loans': 'Préstamo Express',
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/auth/login');
    };

    const filteredNavItems = navItems.filter(item =>
        !item.roles || (user?.usuario && item.roles.includes(user.usuario.rol))
    );

    const currentPageTitle = pageTitles[pathname] || 'Sistema de Actas';

    const isActiveRoute = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground flex">
                {/* Mobile Sidebar Toggle */}
                <button
                    className="lg:hidden fixed bottom-4 right-4 z-50 p-4 bg-primary text-white rounded-full shadow-elegant-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? <LucideX size={20} /> : <LucideMenu size={20} />}
                </button>

                {/* Mobile Overlay */}
                {isSidebarOpen && (
                    <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`
                    fixed inset-y-0 left-0 z-40 w-72 glass-strong border-r border-border shadow-elegant-xl
                    transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-0
                    flex flex-col
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    {/* Logo Header */}
                    <div className="p-6 border-b border-border/50">
                        <Link href="/dashboard" className="flex items-center gap-3 group">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-md group-hover:ring-primary/40 transition-all duration-200">
                                <Image
                                    src="/logo-serviciudad.png"
                                    alt="SERVICIUDAD ESP"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-bold text-foreground leading-tight text-sm">SERVICIUDAD</h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Activos Fijos</p>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                        <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            NavegaciÃ³n
                        </p>
                        {filteredNavItems.map((item) => {
                            const isActive = isActiveRoute(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm
                                        transition-all duration-200 group relative
                                        ${isActive 
                                            ? 'bg-primary text-primary-foreground shadow-md' 
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }
                                    `}
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    <item.icon size={20} className={isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground transition-colors'} />
                                    <span className="flex-1">{item.label}</span>
                                    {isActive && (
                                        <LucideChevronRight size={16} className="text-primary-foreground/70" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Section */}
                    <div className="p-4 border-t border-border/50 bg-muted/30">
                        <div className="flex items-center gap-3 p-3 mb-3 rounded-lg bg-card/50 border border-border/50">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-sm font-bold shadow-md">
                                {user?.usuario?.nombre ? user.usuario.nombre.substring(0, 2).toUpperCase() : 'US'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{user?.usuario?.nombre || 'Usuario'}</p>
                                <p className="text-xs text-muted-foreground capitalize font-medium">{user?.usuario?.rol || 'Sin rol'}</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-border/50"
                            onClick={handleLogout}
                        >
                            <LucideLogOut size={18} />
                            <span>Cerrar SesiÃ³n</span>
                        </Button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Header */}
                    <header className="h-16 glass border-b border-border/50 flex items-center px-6 lg:px-10 sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="hidden lg:flex w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                                <LucideLayoutDashboard className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground">{currentPageTitle}</h1>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider hidden lg:block">
                                    SERVICIUDAD ESP
                                </p>
                            </div>
                        </div>
                    </header>

                    {/* Page Content */}
                    <div className="flex-1 overflow-auto p-6 lg:p-10">
                        {children}
                    </div>

                    {/* Footer */}
                    <Footer compact />
                </main>
            </div>
        </AuthGuard>
    );
}
