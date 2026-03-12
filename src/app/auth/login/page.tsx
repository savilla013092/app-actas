'use client';

import Image from 'next/image';

import { LoginForm } from '@/components/forms/LoginForm';

export default function LoginPage() {
  return (
    <div className='flex min-h-screen'>
      <div className='relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-blue-800 lg:flex lg:w-1/2 xl:w-3/5'>
        <div className='absolute inset-0 opacity-10'>
          <div className='absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white' />
          <div className='absolute bottom-0 right-0 h-[600px] w-[600px] translate-x-1/3 translate-y-1/3 rounded-full bg-white' />
          <div className='absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-white' />
        </div>

        <div className='relative z-10 flex w-full flex-col items-center justify-center p-12 text-white'>
          <div className='mb-8 w-32 rounded-2xl bg-white/20 p-4 shadow-2xl ring-1 ring-white/30 backdrop-blur-sm'>
            <Image src='/logo-serviciudad.png' alt='SERVICIUDAD ESP' width={128} height={128} className='h-full w-full object-contain' />
          </div>

          <h1 className='mb-4 text-center text-4xl font-bold xl:text-5xl'>SERVICIUDAD</h1>
          <p className='mb-2 text-center text-xl text-white/80'>Empresa de Servicios Públicos</p>
          <div className='my-6 h-1 w-24 rounded-full bg-white/30' />
          <p className='max-w-md text-center text-lg text-white/70'>Sistema de Actas de Revisión de Activos Fijos</p>

          <div className='mt-12 max-w-md space-y-4'>
            {[
              'Registro fotográfico de evidencias',
              'Firma digital dual',
              'Generación automática de actas PDF',
            ].map((feature) => (
              <div key={feature} className='flex items-center gap-3 text-white/80'>
                <div className='h-2 w-2 rounded-full bg-white/60' />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='relative flex w-full items-center justify-center bg-background p-6 lg:w-1/2 lg:p-12 xl:w-2/5'>
        <div className='absolute left-1/2 top-8 -translate-x-1/2 lg:hidden'>
          <div className='w-16 rounded-xl bg-primary/15 p-2 ring-1 ring-primary/20'>
            <Image src='/logo-serviciudad.png' alt='SERVICIUDAD ESP' width={64} height={64} className='h-full w-full object-contain' />
          </div>
        </div>

        <div className='w-full max-w-md'>
          <div className='mt-16 text-center lg:hidden'>
            <h1 className='text-2xl font-bold text-foreground'>SERVICIUDAD ESP</h1>
            <p className='mt-1 text-muted-foreground'>Sistema de Actas</p>
          </div>

          <div className='overflow-hidden rounded-2xl border border-border/50 glass-strong shadow-elegant-xl'>
            <div className='p-8'>
              <div className='mb-8 hidden lg:block'>
                <h2 className='text-2xl font-bold text-foreground'>Bienvenido</h2>
                <p className='mt-1 text-muted-foreground'>Ingrese sus credenciales para continuar.</p>
              </div>

              <LoginForm />
            </div>

            <div className='border-t border-border/50 bg-muted/30 px-8 py-5'>
              <p className='text-center text-xs text-muted-foreground'>
                ¿No tiene acceso? <span className='font-medium text-primary'>Contacte al administrador de TI</span>
              </p>
            </div>
          </div>

          <p className='mt-6 text-center text-xs text-muted-foreground'>
            © {new Date().getFullYear()} SERVICIUDAD ESP. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
