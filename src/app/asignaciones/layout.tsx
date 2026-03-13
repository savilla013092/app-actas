'use client';

import DashboardLayout from '@/app/dashboard/layout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { RolUsuario } from '@/types/usuario';

const ALLOWED_ROLES: RolUsuario[] = ['admin', 'logistica', 'custodio'];

export default function AsignacionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <AuthGuard allowedRoles={ALLOWED_ROLES}>{children}</AuthGuard>
    </DashboardLayout>
  );
}
