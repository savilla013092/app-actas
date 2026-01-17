'use client';

import { AuthGuard } from '@/components/layout/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    LucideLayoutDashboard,
    LucideClipboardList,
    LucideBox,
    LucideUsers,
    LucideLogOut,
    LucideMenu,
    LucideX
} from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/auth/login');
    };

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LucideLayoutDashboard, roles: ['admin', 'logistica', 'custodio'] },
        { label: 'Activos', href: '/activos', icon: LucideBox, roles: ['admin', 'logistica', 'custodio'] },
        { label: 'Revisiones', href: '/revision', icon: LucideClipboardList, roles: ['admin', 'logistica'] },
        { label: 'Usuarios', href: '/admin/usuarios', icon: LucideUsers, roles: ['admin'] },
    ];

    const filteredNavItems = navItems.filter(item =>
        !item.roles || (user?.usuario && item.roles.includes(user.usuario.rol))
    );

    return (
        <AuthGuard>
            <div className="min-h-screen bg-gray-100 flex">
                {/* Mobile Sidebar Toggle */}
                <button
                    className="lg:hidden fixed bottom-4 right-4 z-50 p-3 bg-primary text-white rounded-full shadow-lg"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? <LucideX /> : <LucideMenu />}
                </button>

                {/* Sidebar */}
                <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
                    <div className="h-full flex flex-col">
                        <div className="p-6 border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <span className="text-primary font-bold">S</span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-gray-900 leading-none">SERVICIUDAD</h2>
                                    <p className="text-xs text-gray-500 mt-1">Activos Fijos</p>
                                </div>
                            </div>
                        </div>

                        <nav className="flex-1 p-4 space-y-2">
                            {filteredNavItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="flex items-center gap-3 p-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-primary transition-colors"
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    <item.icon size={20} />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            ))}
                        </nav>

                        <div className="p-4 border-t">
                            <div className="flex items-center gap-3 p-3 mb-4">
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                                    {user?.usuario?.nombre ? user.usuario.nombre.substring(0, 2).toUpperCase() : 'US'}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-gray-900 truncate">{user?.usuario?.nombre || 'Usuario'}</p>
                                    <p className="text-xs text-gray-500 capitalize">{user?.usuario?.rol || 'Sin rol'}</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                                onClick={handleLogout}
                            >
                                <LucideLogOut size={18} />
                                Cerrar Sesión
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <header className="h-16 bg-white border-b flex items-center px-8 lg:px-12">
                        <h1 className="text-lg font-bold text-gray-800">Dashboard</h1>
                    </header>
                    <div className="flex-1 overflow-auto p-8 lg:p-12">
                        {children}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
