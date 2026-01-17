// Utilidad para obtener la IP del cliente
export async function obtenerIPCliente(): Promise<string> {
    try {
        // Usar un servicio gratuito para obtener la IP pública
        const response = await fetch('https://api.ipify.org?format=json');
        if (response.ok) {
            const data = await response.json();
            return data.ip;
        }
    } catch (error) {
        console.warn('No se pudo obtener la IP del cliente:', error);
    }
    return 'IP no disponible';
}
