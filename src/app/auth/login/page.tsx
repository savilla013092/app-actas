'use client';

import { LoginForm } from '@/components/forms/LoginForm';
import Image from 'next/image';

export default function LoginPage() {
    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-primary via-primary to-blue-800 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-white rounded-full translate-x-1/3 translate-y-1/3" />
                    <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-white rounded-full" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-8 shadow-2xl ring-1 ring-white/30">
                        <Image
                            src="/logo-serviciudad.png"
                            alt="SERVICIUDAD ESP"
                            width={128}
                            height={128}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    
                    <h1 className="text-4xl xl:text-5xl font-bold text-center mb-4">
                        SERVICIUDAD
                    </h1>
                    <p className="text-xl text-white/80 text-center mb-2">
                        Empresa de Servicios Públicos
                    </p>
                    <div className="w-24 h-1 bg-white/30 rounded-full my-6" />
                    <p className="text-lg text-white/70 text-center max-w-md">
                        Sistema de Actas de Revisión de Activos Fijos
                    </p>
                    
                    {/* Features */}
                    <div className="mt-12 space-y-4 max-w-md">
                        {[
                            'Registro fotográfico de evidencias',
                            'Firma digital dual',
                            'Generación automática de actas PDF',
                        ].map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-white/80">
                                <div className="w-2 h-2 rounded-full bg-white/60" />
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 lg:p-12 bg-background relative">
                {/* Mobile Logo */}
                <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2">
                    <div className="w-16 h-16 bg-primary/15 rounded-xl p-2 ring-1 ring-primary/20">
                        <Image
                            src="/logo-serviciudad.png"
                            alt="SERVICIUDAD ESP"
                            width={64}
                            height={64}
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                <div className="w-full max-w-md">
                    {/* Mobile Title */}
                    <div className="lg:hidden text-center mb-8 mt-16">
                        <h1 className="text-2xl font-bold text-foreground">SERVICIUDAD ESP</h1>
                        <p className="text-muted-foreground mt-1">Sistema de Actas</p>
                    </div>

                    {/* Login Card */}
                    <div className="glass-strong rounded-2xl shadow-elegant-xl border border-border/50 overflow-hidden">
                        <div className="p-8">
                            {/* Desktop Header */}
                            <div className="hidden lg:block mb-8">
                                <h2 className="text-2xl font-bold text-foreground">Bienvenido</h2>
                                <p className="text-muted-foreground mt-1">
                                    Ingrese sus credenciales para continuar
                                </p>
                            </div>

                            <LoginForm />
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 bg-muted/30 border-t border-border/50">
                            <p className="text-xs text-muted-foreground text-center">
                                ¿No tiene acceso?{' '}
                                <span className="text-primary font-medium">
                                    Contacte al administrador de TI
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Copyright */}
                    <p className="text-xs text-muted-foreground text-center mt-6">
                        © {new Date().getFullYear()} SERVICIUDAD ESP. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
}
