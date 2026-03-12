'use client';

import DashboardLayout from '@/app/dashboard/layout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { RolUsuario } from '@/types/usuario';

const ADMIN_ROLES: RolUsuario[] = ['admin'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <AuthGuard allowedRoles={ADMIN_ROLES}>{children}</AuthGuard>
    </DashboardLayout>
  );
}
