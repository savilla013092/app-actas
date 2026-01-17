import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, doc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';

// IMPORTANTE: Esta ruta es solo para desarrollo
// Eliminar o proteger en producción

const custodiosDemo = [
    {
        id: 'custodio_demo_001',
        email: 'maria.gonzalez@serviciudad.gov.co',
        nombre: 'María González López',
        cedula: '1000000003',
        cargo: 'Técnico Administrativo',
        dependencia: 'Secretaría General',
        telefono: '3005551234',
        rol: 'custodio',
        activo: true,
    },
    {
        id: 'custodio_demo_002',
        email: 'pedro.ramirez@serviciudad.gov.co',
        nombre: 'Pedro Ramírez Díaz',
        cedula: '1000000004',
        cargo: 'Auxiliar Administrativo',
        dependencia: 'Tesorería',
        telefono: '3005554321',
        rol: 'custodio',
        activo: true,
    },
];

const activosIniciales = [
    {
        id: 'activo001',
        codigo: 'AF-MOB-2024-0001',
        descripcion: 'Escritorio ejecutivo en madera',
        categoria: 'Mobiliario',
        marca: 'Inval',
        modelo: 'EJ-200',
        serial: 'INV2024001',
        ubicacion: 'Oficina 201',
        dependencia: 'Secretaría General',
        custodioId: 'custodio_demo_001',
        custodioNombre: 'María González López',
        estado: 'activo',
        valorAdquisicion: 850000,
    },
    {
        id: 'activo002',
        codigo: 'AF-COM-2024-0001',
        descripcion: 'Computador portátil HP ProBook',
        categoria: 'Equipo Cómputo',
        marca: 'HP',
        modelo: 'ProBook 450 G8',
        serial: 'HP2024XYZ123',
        ubicacion: 'Oficina 201',
        dependencia: 'Secretaría General',
        custodioId: 'custodio_demo_001',
        custodioNombre: 'María González López',
        estado: 'activo',
        valorAdquisicion: 3500000,
    },
    {
        id: 'activo003',
        codigo: 'AF-MOB-2024-0002',
        descripcion: 'Silla ergonómica giratoria',
        categoria: 'Mobiliario',
        marca: 'Rimax',
        modelo: 'Ergonomic Pro',
        serial: 'RMX2024002',
        ubicacion: 'Oficina 105',
        dependencia: 'Tesorería',
        custodioId: 'custodio_demo_002',
        custodioNombre: 'Pedro Ramírez Díaz',
        estado: 'activo',
        valorAdquisicion: 450000,
    },
    {
        id: 'activo004',
        codigo: 'AF-COM-2024-0002',
        descripcion: 'Monitor LED 24 pulgadas',
        categoria: 'Equipo Cómputo',
        marca: 'LG',
        modelo: '24MK430H',
        serial: 'LG2024MON456',
        ubicacion: 'Oficina 105',
        dependencia: 'Tesorería',
        custodioId: 'custodio_demo_002',
        custodioNombre: 'Pedro Ramírez Díaz',
        estado: 'activo',
        valorAdquisicion: 750000,
    },
    {
        id: 'activo005',
        codigo: 'AF-OFI-2024-0001',
        descripcion: 'Impresora multifuncional láser',
        categoria: 'Equipo Oficina',
        marca: 'Epson',
        modelo: 'EcoTank L6270',
        serial: 'EPS2024PRT789',
        ubicacion: 'Área común piso 2',
        dependencia: 'Dirección Administrativa',
        custodioId: 'custodio_demo_001',
        custodioNombre: 'María González López',
        estado: 'activo',
        valorAdquisicion: 1200000,
    },
];

export async function GET() {
    try {
        // Verificar si ya hay activos
        const activosSnap = await getDocs(collection(db, 'activos'));
        if (!activosSnap.empty) {
            return NextResponse.json({
                success: false,
                message: 'Ya existen activos en la base de datos. Elimínalos desde Firebase Console si deseas reiniciar.',
                activos: activosSnap.size
            });
        }

        // Crear custodios de demostración
        for (const custodio of custodiosDemo) {
            await setDoc(doc(db, 'usuarios', custodio.id), {
                ...custodio,
                creadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp(),
                creadoPor: 'seed',
            });
        }

        // Crear activos
        for (const activo of activosIniciales) {
            await setDoc(doc(db, 'activos', activo.id), {
                ...activo,
                creadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp(),
                creadoPor: 'seed',
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Datos de prueba creados exitosamente',
            custodios: custodiosDemo.length,
            activos: activosIniciales.length,
        });
    } catch (error) {
        console.error('Error en seed:', error);
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 });
    }
}
