# Guía de Importación de Activos - Paso a Paso

## Prerrequisitos

1. Tener Node.js instalado
2. Tener acceso a Firebase (credenciales configuradas)
3. El archivo `Listado_activos.xlsx` debe estar en la raíz del proyecto

---

## Paso 1: Instalar dependencias (si no están instaladas)

```bash
npm install firebase-admin xlsx
```

---

## Paso 2: Configurar credenciales de Firebase Admin

Asegúrate de tener configurado uno de estos métodos:

**Opción A - Application Default Credentials:**
```bash
gcloud auth application-default login
```

**Opción B - Service Account Key:**
1. Descargar el archivo JSON de credenciales desde Firebase Console
2. Configurar la variable de entorno:
```bash
set GOOGLE_APPLICATION_CREDENTIALS=ruta/al/archivo-credenciales.json
```

---

## Paso 3: Ejecutar script de limpieza

Este paso eliminará todos los activos y revisiones existentes.

```bash
node scripts/limpiar-datos.js
```

**Salida esperada:**
```
============================================================
LIMPIEZA DE DATOS - SERVICIUDAD ESP
============================================================
Eliminando activos...
  Eliminados X activos
Eliminando revisiones...
  Eliminadas X revisiones
============================================================
LIMPIEZA COMPLETADA
============================================================
```

---

## Paso 4: Ejecutar script de importación

```bash
node scripts/importar-activos.js
```

**Salida esperada:**
```
============================================================
IMPORTACIÓN DE ACTIVOS - SERVICIUDAD ESP
============================================================
Leyendo archivo: ...\Listado_activos.xlsx
Total de filas: XXXX
  Importados 500 activos...
  Importados 1000 activos...
  ...
============================================================
RESUMEN DE IMPORTACIÓN
============================================================
✓ Activos importados: XXXX
- Activos omitidos: X

¡Importación completada exitosamente!
```

---

## Paso 5: Verificación

### 5.1 Verificar en Firebase Console
1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar proyecto `serviciudad-actas`
3. Ir a Firestore Database
4. Verificar colección `activos` - debe tener todos los registros importados

### 5.2 Verificar en la aplicación web
1. Iniciar el servidor de desarrollo:
```bash
npm run dev
```
2. Abrir http://localhost:3000
3. Iniciar sesión y navegar a la lista de activos
4. Verificar que se muestran los activos importados

### 5.3 Verificar funcionalidad de revisiones
1. Intentar crear una nueva revisión
2. Verificar que se puede seleccionar un activo de la lista
3. Completar el flujo de revisión para confirmar que todo funciona

---

## Solución de Problemas

### Error: "Could not load the default credentials"
Solución: Ejecutar `gcloud auth application-default login` o configurar GOOGLE_APPLICATION_CREDENTIALS

### Error: "PERMISSION_DENIED"
Solución: Verificar que la cuenta tenga permisos de escritura en Firestore

### Error: "Cannot find module 'xlsx'"
Solución: Ejecutar `npm install xlsx`

### El archivo Excel no se encuentra
Solución: Verificar que `Listado_activos.xlsx` esté en la raíz del proyecto (mismo nivel que package.json)

---

## Resumen de Comandos

```bash
# 1. Instalar dependencias (si es necesario)
npm install firebase-admin xlsx

# 2. Limpiar datos existentes
node scripts/limpiar-datos.js

# 3. Importar activos
node scripts/importar-activos.js

# 4. Verificar en la app
npm run dev
```
