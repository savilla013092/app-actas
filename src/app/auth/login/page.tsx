'use client';

import { LoginForm } from '@/components/forms/LoginForm';
import Image from 'next/image';

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
            <div className="max-w-md w-full bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
                <div className="p-8">
                    <div className="text-center mb-8">
                        {/* Logo placeholder - replace with actual logo if available */}
                        <div className="w-20 h-20 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/20">
                            <span className="text-primary font-bold text-2xl">S</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Bienvenido</h1>
                        <p className="text-muted-foreground mt-1">Sistema de Actas - SERVICIUDAD ESP</p>
                    </div>

                    <LoginForm />

                    <div className="mt-8 pt-6 border-t border-border text-center">
                        <p className="text-sm text-muted-foreground">
                            ¿No tiene acceso? Contacte al administrador de TI.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
