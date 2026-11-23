# Agenda Odontológica - Consultorio Cristo Rey

Sistema integral para gestionar usuarios, citas, pacientes, tratamientos,
evolución clínica, odontograma e inventario del Consultorio Odontológico Cristo Rey,
con módulo predictivo de ausentismo basado en Machine Learning.

---

## Tecnologías

- **Contenedores:** Docker & Docker Compose
- **Frontend Web:** HTML5, CSS3, JavaScript modular (ES Modules), Nginx
- **Backend API:** Node.js (v20) y Express 4
- **Base de Datos:** SQLite 3 (relacional, portable y persistida en volúmenes Docker)
- **Escritorio:** Electron (v43) y electron-builder
- **Ciencia de Datos / IA:** Python (pandas, Matplotlib, scikit-learn) para entrenamiento y artefacto JSON para inferencia determinista en Node.js

---

## Guía de Instalación y Despliegue con Docker (Recomendado)

El proyecto está completamente preparado para levantarse con **Docker Compose** en una arquitectura de microservicios compuesta por 3 contenedores:

- **`frontend`**: Servidor web **Nginx** (puerto 80). Entrega la interfaz de usuario, aplica compresión gzip, gestiona el almacenamiento en caché y actúa como proxy inverso hacia la API y los archivos protegidos.
- **`backend`**: Servidor de API **Node.js / Express** (puerto interno 3000). Procesa la autenticación JWT, las reglas de negocio, la validación de esquemas (Zod) y la inferencia predictiva de ausentismo.
- **`db`** (alias **`DB`**): Gestor de persistencia **SQLite 3**. Controla la inicialización de esquemas, migraciones iniciales, verificación continua de integridad (`PRAGMA quick_check;`) y respaldos automáticos rotativos.

### Requisitos previos

- **Docker Desktop** (en Windows o macOS) con el motor iniciado, o **Docker Engine + Docker Compose v2** (en Linux).

---

### Paso 1: Configurar Variables de Entorno

El proyecto incluye un archivo de plantilla con configuraciones listas para usar. Si no tienes un archivo `.env`, créalo copiando el archivo de ejemplo:

```bash
# En PowerShell / CMD:
copy .env.example .env

# En Bash / Linux / macOS:
cp .env.example .env
```

Variables principales en `.env`:
* `PORT=80`: Puerto público de acceso en el host (Frontend).
* `BACKEND_PORT=3000`: Puerto interno del backend.
* `JWT_SECRET`: Secreto criptográfico para firma de tokens (mínimo 64 caracteres en producción).
* `SEED_DEFAULT_USERS=true`: Inicializa automáticamente los usuarios de prueba si la base de datos está vacía.
* `BACKUP_INTERVAL=21600`: Frecuencia de respaldos automáticos del contenedor `db` en segundos (por defecto cada 6 horas).

---

### Paso 2: Base de Datos, Inicialización y Migraciones

La persistencia de datos se maneja a través de volúmenes de Docker (`agenda_db_data`, `agenda_uploads_data` y `agenda_db_backups`), por lo que los datos no se pierden al reiniciar o detener contenedores.

* **Inicialización:** Al iniciar por primera vez, el servicio `db` detecta si existe un archivo `database.db` en el repositorio para restaurarlo con datos completos. Si se arranca desde cero, ejecuta automáticamente [`schema.sql`](schema.sql) creando la estructura normalizada de tablas, claves foráneas e índices.
* **Migraciones automáticas:** Cada vez que el contenedor `backend` se inicia, valida el esquema y ejecuta automáticamente las migraciones DDL necesarias (añadir columnas faltantes de odontograma, historial clínico, tablas intermedias de consumibles de inventario, etc.).
* **Población de datos iniciales (Opcional):**
  Si inicias con una base vacía y deseas cargar pacientes ficticios o catálogo de insumos de prueba, puedes ejecutar:
  ```bash
  # Cargar citas y pacientes de simulación:
  docker compose exec backend node seed-demo-data.js

  # Cargar catálogo de proveedores e insumos de inventario:
  docker compose exec backend node seed-inventory-data.js
  ```

---

### Paso 3: Iniciar los Servicios con Docker Compose

Ejecuta el siguiente comando en la terminal desde la carpeta raíz del proyecto:

```bash
docker compose up -d --build
```

*(O si utilizas npm en tu máquina local)*:
```bash
npm run docker:up
```

#### Comprobar el estado de los servicios:
```bash
docker compose ps
```
Los servicios `agenda_db` y `agenda_backend` deben figurar como **`(healthy)`**, y `agenda_frontend` como **`Up`**.

---

### Paso 4: Acceso a la Aplicación y Credenciales

Abre tu navegador web e ingresa a:
```text
http://localhost
```
*(o `http://localhost:<PORT>` si modificaste el puerto en `.env`)*.

#### Credenciales predeterminadas para pruebas:

| Rol | Correo Electrónico | Contraseña |
| :--- | :--- | :--- |
| **Odontólogo (Administrador)** | `admin@agenda.com` | `Admin123*` |
| **Odontólogo (Alternativo)** | `admin@agendaodontologica.com` | `Admin123*` |
| **Recepcionista** | `recepcion@agenda.com` | `Admin123*` |

---

### Paso 5: Comandos de Mantenimiento y Operación Útiles

| Tarea | Comando Docker |
| :--- | :--- |
| **Ver registros (logs) en tiempo real** | `docker compose logs -f` |
| **Ver registros únicamente del backend** | `docker compose logs backend -f` |
| **Crear nuevo odontólogo interactivo** | `docker compose exec backend node scripts/create-admin.js` |
| **Limpiar citas y pacientes (mantener catálogo)** | `docker compose exec backend node clean-db.js` |
| **Acceder a la consola SQLite interactiva** | `docker compose exec db sqlite3 /data/database.db` |
| **Detener los servicios (conservando datos)** | `docker compose down` |
| **Detener y reiniciar desde cero (borrar datos)** | `docker compose down -v` |

---

## Ejecución en Modo Desarrollo Local (Sin Docker)

Si prefieres ejecutar el proyecto directamente en el sistema operativo host:

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
