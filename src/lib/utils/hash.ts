export async function calcularHash(datos: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(datos);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
