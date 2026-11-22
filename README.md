# Agenda Odontologica - Consultorio Cristo Rey

Aplicacion de escritorio para gestionar usuarios, citas, pacientes, tratamientos,
evolucion clinica e inventario del Consultorio Odontologico Cristo Rey.

## Tecnologias

- Electron
- Node.js y Express
- SQLite
- HTML, CSS y JavaScript
- Python, pandas, Matplotlib y scikit-learn

## Requisitos

- Windows 10 o Windows 11
- Node.js 18 o superior
- npm
- Python 3.10 o superior

## Instalacion en modo desarrollo

Desde PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
npm run electron:dev
```

Tambien puede ejecutarse solo el servidor web:

```powershell
npm start
```

Despues abra `http://localhost:3000`.

## Instalador

El instalador generado para Windows se encuentra en:

```text
dist/Agenda Odontologica Setup 1.0.0.exe
```

## Base de datos

La base operativa se crea o inicializa con:

- `database.db`: copia de datos y estructura utilizada por Electron.
- `schema.sql`: script de creacion de tablas.
- `exportacion_bd/agenda_odontologica_dump.sql`: exportacion SQL.
- `exportacion_bd/simulacion_2026-08-23_a_2026-11-16/`: datos de prueba y CSV.

No publique credenciales, pacientes reales, documentos de identidad ni copias
clinicas reales. Las exportaciones para el proyecto deben conservar el
anonimizacion y separar los registros sintéticos.

## Configuracion

La aplicacion Electron usa una copia persistente de `database.db` ubicada en
`%APPDATA%` y almacena adjuntos en la carpeta de datos del usuario. No se requiere
configurar una variable de entorno para la ejecucion normal.

Para ejecutar Express fuera de Electron puede establecerse un puerto:

```powershell
$env:PORT="3000"
npm start
```

## Preparacion para VPS y dominio

El equipo de desarrollo puede ser Windows; el despliegue preparado en esta
seccion es para un VPS Ubuntu/Debian con Node.js, systemd y Nginx. El notebook
no se ejecuta en el servidor: la prediccion usa el JSON incluido en el proyecto.
Una vez publicado, la aplicacion web se puede usar desde navegadores actuales en
Windows o Linux; el sistema operativo de la computadora del usuario no necesita
coincidir con el del VPS. No se deben copiar `node_modules` de Windows al VPS:
`npm ci --omit=dev` instala las dependencias para el sistema del servidor.

Los archivos de referencia estan en `deploy/`:

- `agenda-odontologica.env.example`: variables de produccion. Copiarlo al VPS
  como `/etc/agenda-odontologica/agenda.env` y reemplazar el secreto de ejemplo.
- `systemd/agenda-odontologica.service`: ejecuta Node con usuario sin privilegios
  y conserva la base y los adjuntos en `/var/lib/agenda-odontologica/`.
- `nginx/agenda-odontologica.conf.example`: plantilla para activar cuando exista
  el dominio y se hayan emitido los certificados TLS.

Preparacion inicial en el VPS:

1. Instalar una version LTS de Node.js y Nginx. Copiar el codigo a
   `/opt/agenda-odontologica`, sin copiar `.env`, `database.db`, respaldos,
   `public/uploads/` ni datos clinicos. Ejecutar `npm ci --omit=dev`.
2. Crear el usuario de sistema `agenda` y la carpeta de estado
   `/var/lib/agenda-odontologica` con permisos solo para ese usuario.
3. Copiar el archivo de variables de ejemplo a
   `/etc/agenda-odontologica/agenda.env`, restringir sus permisos y generar un
   secreto propio con `openssl rand -hex 32`. No reutilizar ni compartir ese
   secreto.
4. Instalar la unidad systemd, iniciar el servicio una vez para crear una base
   vacia, detenerlo y crear la primera cuenta odontologo desde una terminal SSH:

   ```sh
   sudo -u agenda env DB_PATH=/var/lib/agenda-odontologica/database.db \
     /usr/bin/node /opt/agenda-odontologica/scripts/create-admin.js
   ```

   La contrasena se solicita sin mostrarla y requiere al menos 12 caracteres.
   Luego se puede iniciar de nuevo el servicio. En produccion el registro solo
   esta disponible para un odontologo autenticado.
5. Antes de tener dominio, mantener el puerto 3000 cerrado al exterior. Para
   una prueba privada desde Windows, abrir un tunel SSH:

   ```powershell
   ssh -L 3000:127.0.0.1:3000 usuario@IP_DEL_VPS
   ```

   Mientras el tunel siga abierto, visitar `http://localhost:3000` en la
   computadora local. No usar HTTP publico para iniciar sesion ni para datos
   clinicos.
6. Cuando se tenga el dominio, apuntar sus registros DNS a la IP del VPS,
   obtener certificados TLS, reemplazar `example.com` y las rutas de certificado
   en la plantilla Nginx, y exponer solo SSH, HTTP y HTTPS en el firewall. No
   exponer directamente el puerto 3000.

La configuracion falla al arrancar en produccion si falta un `JWT_SECRET`
seguro, si no se configura el proxy local o si Node intenta escuchar fuera de
`127.0.0.1`. Los archivos adjuntos requieren sesion y no se almacenan en la
carpeta publica del codigo. La recuperacion de contrasena queda deshabilitada
en produccion hasta implementar y configurar un flujo real de correo seguro.

**Datos clinicos reales:** estos archivos preparan el servicio, pero no
certifican la aplicacion para uso clinico ni sustituyen una revision de
seguridad, autorizacion del consultorio y cumplimiento de las normas de
privacidad aplicables. No subir la base local ni adjuntos al VPS o a GitHub.
Antes de migrar datos reales, verificar y cambiar las credenciales existentes,
acordar un respaldo cifrado y probar su restauracion; mientras tanto, usar una
base nueva con datos sinteticos.

## Pruebas manuales

1. Iniciar sesion como odontologo o recepcionista.
2. Verificar el calendario y crear una cita.
3. Registrar o consultar un paciente.
4. Crear un tratamiento y vincularlo a una cita.
5. Registrar evolucion clinica.
6. Registrar entradas o movimientos de inventario.
7. Consultar reportes y cerrar sesion.

## Analisis de ciencia de datos

El notebook se encuentra en:

```text
Proyecto_Ciencia_de_Datos/EDA_Agenda_Odontologica.ipynb
```

Los modelos entrenados se encuentran en:

```text
Proyecto_Ciencia_de_Datos/modelos/regresion_logistica.joblib
Proyecto_Ciencia_de_Datos/modelos/random_forest.joblib
```

En la aplicación, la sección **Predicción** está dentro de **Reportes**. Usa el
artefacto `regresion_logistica_node.json`, generado por el mismo script de
entrenamiento, para realizar inferencias localmente sin instalar Python en la
aplicación. El modelo fue evaluado con datos sintéticos y tiene un recall de
ausencias del 30% en la prueba temporal; es una demostración académica y no debe
usarse para tomar decisiones sobre citas reales.

Los CSV utilizados se encuentran en:

```text
exportacion_bd/simulacion_2026-08-23_a_2026-11-16/csv/
```

Los registros sintéticos sirven para demostrar el procedimiento de analisis y
clasificacion. No representan comportamiento real de pacientes ni deben usarse
para decisiones clinicas o administrativas.

En **Predicción** la búsqueda de pacientes registrados es opcional: se puede
seleccionar uno para completar edad,
sexo e historial con citas anteriores vinculadas a su ficha. Si la ficha no
tiene edad, sexo o citas vinculadas, esos campos se completan manualmente.
Para pacientes nuevos o sin registro, todos los datos del paciente se ingresan
manualmente o quitar la selección para volver al ingreso manual; esta operación
no crea una ficha ni una cita. Una cita no crea automáticamente una ficha y
puede no estar vinculada a un paciente.

## Empaquetado

Para generar nuevamente el instalador:

```powershell
npm run electron:build
```

El resultado se genera en la carpeta `dist`.

## Estructura principal

- `src/`: servidor Express y proceso Electron.
- `public/`: interfaz web.
- `build/`: recursos de empaquetado.
- `exportacion_bd/`: SQL, SQLite y CSV de prueba.
- `Proyecto_Ciencia_de_Datos/`: notebook, modelos y figuras.
- `report_assets/screenshots/`: capturas usadas en el informe.
