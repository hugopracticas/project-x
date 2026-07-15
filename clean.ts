import {
  confirmWithY,
  greenColor,
  readLinesFromFile,
  redColor,
  runBashOverDoubleSsh,
} from "./utils.js";

import type { CommandResult } from "./types.js";

/**
 * Servidores a través de los cuales se ejecutarán los comandos.
 *
 * Flujo:
 * computadora local -> jump host -> target host
 */
const JUMP_HOST = "ssh1-den";
const TARGET_HOST = "den-r17-u14";

/**
 * Volumen anterior, del cual se eliminarán los respaldos viejos.
 *
 * Debes confirmar la IP o nombre del servidor NFS anterior.
 */
const SOURCE_BACKUP_DEVICE_IP = "IP_DEL_VOLUMEN_ANTERIOR";
const SOURCE_BACKUP_DEVICE_DIRECTORY = "/vol/dbbackup_vol";
const SOURCE_BACKUP_DEVICE =
  `${SOURCE_BACKUP_DEVICE_IP}:${SOURCE_BACKUP_DEVICE_DIRECTORY}`;

/**
 * Volumen nuevo.
 */
const TARGET_BACKUP_DEVICE_IP = "10.207.12.40";
const TARGET_BACKUP_DEVICE_DIRECTORY = "/mdbs_backup1";
const TARGET_BACKUP_DEVICE =
  `${TARGET_BACKUP_DEVICE_IP}:${TARGET_BACKUP_DEVICE_DIRECTORY}`;

/**
 * Directorios locales del servidor TARGET_HOST donde serán montados
 * temporalmente los dos volúmenes NFS.
 */
const SOURCE_MOUNT_POINT = "/mnt/mdbs_backups/source_backup_cleanup";
const TARGET_MOUNT_POINT = "/mnt/mdbs_backups/target_backup_cleanup";

/**
 * Archivo que contiene la lista de bases de datos.
 *
 * Se espera una base de datos o directorio por línea.
 * Las líneas vacías y las líneas iniciadas con # serán ignoradas
 * por readLinesFromFile().
 */
const DATABASES_FILE = "databases_to_cleanup.txt";

/**
 * Un respaldo ubicado en el volumen nuevo se considera reciente
 * cuando tiene como máximo esta cantidad de días.
 */
const RECENT_BACKUP_MAX_AGE_DAYS = 7;

/**
 * Un respaldo del volumen anterior puede eliminarse cuando tenga
 * más de esta cantidad de días.
 *
 * 21 días = 3 semanas.
 */
const OLD_BACKUP_MIN_AGE_DAYS = 21;

/**
 * Seguridad:
 *
 * Sin --execute el programa solamente muestra qué eliminaría.
 *
 * Para borrar realmente:
 *
 * pnpm tsx cleanup.ts --execute
 */
const EXECUTE_DELETION = process.argv.includes("--execute");

type BackupFile = {
  path: string;
  modifiedAt: string;
  sizeBytes: number;
};

type BackupValidation = {
  database: string;
  recentTargetBackups: BackupFile[];
  oldSourceBackups: BackupFile[];
};

/**
 * Convierte la salida JSON emitida por el script Bash en objetos.
 */
function parseBackupFiles(stdout: string): BackupFile[] {
  const cleanOutput = stdout.trim();

  if (!cleanOutput) {
    return [];
  }

  const parsed: unknown = JSON.parse(cleanOutput);

  if (!Array.isArray(parsed)) {
    throw new Error("La respuesta recibida no contiene una lista de respaldos.");
  }

  return parsed.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as BackupFile).path !== "string" ||
      typeof (item as BackupFile).modifiedAt !== "string" ||
      typeof (item as BackupFile).sizeBytes !== "number"
    ) {
      throw new Error("Se recibió información inválida de un respaldo.");
    }

    return item as BackupFile;
  });
}

/**
 * Ejecuta un script remoto y falla cuando el comando termina
 * con un código de salida diferente de cero.
 */
async function executeRemoteScript(
  bashScript: string,
  operation: string,
): Promise<CommandResult> {
  const result = await runBashOverDoubleSsh(
    JUMP_HOST,
    TARGET_HOST,
    bashScript,
  );

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Falló la operación: ${operation}`,
        result.stderr.trim() || result.stdout.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result;
}

/**
 * Crea los puntos de montaje y monta los dos volúmenes.
 *
 * mountpoint -q evita intentar montar un volumen que ya está montado.
 */
async function mountVolumes(): Promise<void> {
  console.log("Montando los volúmenes...");

  const bashScript = `
set -euo pipefail

SOURCE_DEVICE="${SOURCE_BACKUP_DEVICE}"
TARGET_DEVICE="${TARGET_BACKUP_DEVICE}"

SOURCE_MOUNT="${SOURCE_MOUNT_POINT}"
TARGET_MOUNT="${TARGET_MOUNT_POINT}"

sudo mkdir -p "$SOURCE_MOUNT"
sudo mkdir -p "$TARGET_MOUNT"

if mountpoint -q "$SOURCE_MOUNT"; then
  echo "El volumen anterior ya está montado en: $SOURCE_MOUNT"
else
  sudo mount "$SOURCE_DEVICE" "$SOURCE_MOUNT"
  echo "Volumen anterior montado en: $SOURCE_MOUNT"
fi

if mountpoint -q "$TARGET_MOUNT"; then
  echo "El volumen nuevo ya está montado en: $TARGET_MOUNT"
else
  sudo mount "$TARGET_DEVICE" "$TARGET_MOUNT"
  echo "Volumen nuevo montado en: $TARGET_MOUNT"
fi

mountpoint -q "$SOURCE_MOUNT"
mountpoint -q "$TARGET_MOUNT"
`;

  const result = await executeRemoteScript(
    bashScript,
    "montar los volúmenes",
  );

  console.log(result.stdout.trim());
  console.log(greenColor("Los volúmenes fueron montados correctamente."));
}

/**
 * Desmonta ambos volúmenes.
 *
 * Esta función se ejecuta desde finally, incluso si una validación
 * o eliminación produce un error.
 */
async function unmountVolumes(): Promise<void> {
  console.log();
  console.log("Desmontando los volúmenes...");

  const bashScript = `
set +e

SOURCE_MOUNT="${SOURCE_MOUNT_POINT}"
TARGET_MOUNT="${TARGET_MOUNT_POINT}"

EXIT_CODE=0

if mountpoint -q "$SOURCE_MOUNT"; then
  sudo umount "$SOURCE_MOUNT"

  if [ $? -eq 0 ]; then
    echo "Volumen anterior desmontado: $SOURCE_MOUNT"
  else
    echo "No fue posible desmontar el volumen anterior: $SOURCE_MOUNT" >&2
    EXIT_CODE=1
  fi
fi

if mountpoint -q "$TARGET_MOUNT"; then
  sudo umount "$TARGET_MOUNT"

  if [ $? -eq 0 ]; then
    echo "Volumen nuevo desmontado: $TARGET_MOUNT"
  else
    echo "No fue posible desmontar el volumen nuevo: $TARGET_MOUNT" >&2
    EXIT_CODE=1
  fi
fi

exit "$EXIT_CODE"
`;

  const result = await runBashOverDoubleSsh(
    JUMP_HOST,
    TARGET_HOST,
    bashScript,
  );

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }

  if (result.exitCode !== 0) {
    console.error(
      redColor(
        result.stderr.trim() ||
          "Uno o más volúmenes no pudieron desmontarse.",
      ),
    );

    return;
  }

  console.log(greenColor("Los volúmenes fueron desmontados."));
}

/**
 * Busca respaldos recientes de una base de datos en el volumen nuevo.
 *
 * Por ahora se supone que cada base tiene un directorio:
 *
 * /mnt/.../<database>
 *
 * find:
 * - busca archivos;
 * - ignora archivos vacíos;
 * - selecciona archivos modificados durante los últimos N días;
 * - imprime los datos como JSON.
 */
async function findRecentTargetBackups(
  database: string,
): Promise<BackupFile[]> {
  const bashScript = `
set -euo pipefail

DATABASE_NAME=${JSON.stringify(database)}
DATABASE_DIRECTORY="${TARGET_MOUNT_POINT}/$DATABASE_NAME"
MAX_AGE_DAYS=${RECENT_BACKUP_MAX_AGE_DAYS}

if [ ! -d "$DATABASE_DIRECTORY" ]; then
  printf '[]'
  exit 0
fi

python3 - "$DATABASE_DIRECTORY" "$MAX_AGE_DAYS" <<'PYTHON_SCRIPT'
import json
import os
import sys
import time
from pathlib import Path

directory = Path(sys.argv[1])
max_age_days = int(sys.argv[2])
now = time.time()
max_age_seconds = max_age_days * 24 * 60 * 60

backups = []

for path in directory.rglob("*"):
    if not path.is_file():
        continue

    stat = path.stat()

    if stat.st_size <= 0:
        continue

    age_seconds = now - stat.st_mtime

    if age_seconds <= max_age_seconds:
        backups.append({
            "path": str(path),
            "modifiedAt": time.strftime(
                "%Y-%m-%dT%H:%M:%S%z",
                time.localtime(stat.st_mtime),
            ),
            "sizeBytes": stat.st_size,
        })

backups.sort(key=lambda item: item["modifiedAt"], reverse=True)

print(json.dumps(backups))
PYTHON_SCRIPT
`;

  const result = await executeRemoteScript(
    bashScript,
    `buscar respaldos recientes de ${database}`,
  );

  return parseBackupFiles(result.stdout);
}

/**
 * Busca respaldos eliminables en el volumen anterior.
 *
 * Solo devuelve archivos:
 * - que pertenezcan al directorio de la base;
 * - que no estén vacíos;
 * - cuya antigüedad sea mayor a OLD_BACKUP_MIN_AGE_DAYS.
 */
async function findOldSourceBackups(
  database: string,
): Promise<BackupFile[]> {
  const bashScript = `
set -euo pipefail

DATABASE_NAME=${JSON.stringify(database)}
DATABASE_DIRECTORY="${SOURCE_MOUNT_POINT}/$DATABASE_NAME"
MIN_AGE_DAYS=${OLD_BACKUP_MIN_AGE_DAYS}

if [ ! -d "$DATABASE_DIRECTORY" ]; then
  printf '[]'
  exit 0
fi

python3 - "$DATABASE_DIRECTORY" "$MIN_AGE_DAYS" <<'PYTHON_SCRIPT'
import json
import sys
import time
from pathlib import Path

directory = Path(sys.argv[1])
min_age_days = int(sys.argv[2])
now = time.time()
min_age_seconds = min_age_days * 24 * 60 * 60

backups = []

for path in directory.rglob("*"):
    if not path.is_file():
        continue

    stat = path.stat()

    if stat.st_size <= 0:
        continue

    age_seconds = now - stat.st_mtime

    if age_seconds > min_age_seconds:
        backups.append({
            "path": str(path),
            "modifiedAt": time.strftime(
                "%Y-%m-%dT%H:%M:%S%z",
                time.localtime(stat.st_mtime),
            ),
            "sizeBytes": stat.st_size,
        })

backups.sort(key=lambda item: item["modifiedAt"])

print(json.dumps(backups))
PYTHON_SCRIPT
`;

  const result = await executeRemoteScript(
    bashScript,
    `buscar respaldos antiguos de ${database}`,
  );

  return parseBackupFiles(result.stdout);
}

/**
 * Muestra la información encontrada para una base.
 */
function printValidation(validation: BackupValidation): void {
  console.log();
  console.log("------------------------------------------------------------");
  console.log(`Base de datos: ${validation.database}`);

  console.log();
  console.log("Respaldos recientes encontrados en el volumen nuevo:");

  if (validation.recentTargetBackups.length === 0) {
    console.log(redColor("No se encontraron respaldos recientes."));
  } else {
    for (const backup of validation.recentTargetBackups) {
      console.log(
        greenColor(
          `- ${backup.path} | ${backup.modifiedAt} | ${backup.sizeBytes} bytes`,
        ),
      );
    }
  }

  console.log();
  console.log(
    `Respaldos con más de ${OLD_BACKUP_MIN_AGE_DAYS} días en el volumen anterior:`,
  );

  if (validation.oldSourceBackups.length === 0) {
    console.log("No se encontraron respaldos elegibles para eliminación.");
  } else {
    for (const backup of validation.oldSourceBackups) {
      console.log(
        `- ${backup.path} | ${backup.modifiedAt} | ${backup.sizeBytes} bytes`,
      );
    }
  }
}

/**
 * Elimina una lista exacta de archivos.
 *
 * Los paths se envían por stdin al script Python. De esta forma se evita
 * construir un comando rm concatenando rutas proporcionadas externamente.
 */
async function deleteBackups(
  database: string,
  backups: BackupFile[],
): Promise<void> {
  if (backups.length === 0) {
    return;
  }

  const backupPaths = backups.map((backup) => backup.path);

  const bashScript = `
set -euo pipefail

SOURCE_ROOT=${JSON.stringify(`${SOURCE_MOUNT_POINT}/`)}

python3 - "$SOURCE_ROOT" <<'PYTHON_SCRIPT'
import json
import os
import sys
from pathlib import Path

source_root = Path(sys.argv[1]).resolve()
paths = json.loads(sys.stdin.read())

deleted = []

for raw_path in paths:
    path = Path(raw_path).resolve()

    try:
        path.relative_to(source_root)
    except ValueError:
        raise RuntimeError(
            f"Refusing to delete a path outside the source volume: {path}"
        )

    if not path.exists():
        continue

    if not path.is_file():
        raise RuntimeError(f"Refusing to delete a non-file path: {path}")

    path.unlink()
    deleted.append(str(path))

print(json.dumps(deleted))
PYTHON_SCRIPT
`;

  /*
   * Esta variante envía el JSON con las rutas directamente al comando remoto.
   * JSON.stringify protege espacios y caracteres especiales del contenido.
   */
  const scriptWithInput = `
printf '%s' ${JSON.stringify(JSON.stringify(backupPaths))} | {
${bashScript}
}
`;

  const result = await executeRemoteScript(
    scriptWithInput,
    `eliminar respaldos antiguos de ${database}`,
  );

  const deletedFiles = JSON.parse(result.stdout.trim() || "[]") as string[];

  console.log(
    greenColor(
      `${database}: se eliminaron ${deletedFiles.length} respaldos.`,
    ),
  );

  for (const deletedFile of deletedFiles) {
    console.log(`- ${deletedFile}`);
  }
}

/**
 * Ejecuta todas las validaciones para una base de datos.
 */
async function validateDatabase(
  database: string,
): Promise<BackupValidation> {
  const recentTargetBackups = await findRecentTargetBackups(database);

  /*
   * No se buscan respaldos eliminables hasta verificar que existe
   * al menos un respaldo reciente en el volumen nuevo.
   */
  if (recentTargetBackups.length === 0) {
    return {
      database,
      recentTargetBackups,
      oldSourceBackups: [],
    };
  }

  const oldSourceBackups = await findOldSourceBackups(database);

  return {
    database,
    recentTargetBackups,
    oldSourceBackups,
  };
}

/**
 * Procesa una base de datos.
 */
async function processDatabase(database: string): Promise<void> {
  console.log();
  console.log(`Validando la base de datos: ${database}`);

  const validation = await validateDatabase(database);

  printValidation(validation);

  /*
   * Regla 1:
   * Solo puede limpiarse el volumen anterior cuando el nuevo contiene
   * un respaldo reciente y no vacío.
   */
  if (validation.recentTargetBackups.length === 0) {
    console.log(
      redColor(
        `${database}: limpieza cancelada porque no existe un respaldo reciente en el volumen nuevo.`,
      ),
    );

    return;
  }

  /*
   * Regla 2:
   * Deben existir archivos con más de tres semanas en el volumen anterior.
   */
  if (validation.oldSourceBackups.length === 0) {
    console.log(
      `${database}: no existen respaldos antiguos que deban eliminarse.`,
    );

    return;
  }

  /*
   * El modo predeterminado es simulación.
   */
  if (!EXECUTE_DELETION) {
    console.log();
    console.log(
      greenColor(
        `[DRY RUN] ${validation.oldSourceBackups.length} archivos serían eliminados.`,
      ),
    );

    return;
  }

  /*
   * Incluso usando --execute, todavía se solicita una confirmación
   * por cada base de datos.
   */
  const confirmed = await confirmWithY(
    `¿Eliminar ${validation.oldSourceBackups.length} respaldos antiguos de ${database}? [y/N]: `,
  );

  if (!confirmed) {
    console.log(`${database}: eliminación cancelada por el usuario.`);
    return;
  }

  await deleteBackups(database, validation.oldSourceBackups);
}

async function main(): Promise<void> {
  console.log("Iniciando limpieza de respaldos antiguos.");
  console.log(
    EXECUTE_DELETION
      ? redColor("MODO EJECUCIÓN: los archivos aprobados serán eliminados.")
      : greenColor(
          "MODO SIMULACIÓN: no se eliminará ningún archivo.",
        ),
  );

  const databases = await readLinesFromFile(DATABASES_FILE);

  if (databases.length === 0) {
    console.log(
      `El archivo ${DATABASES_FILE} no contiene bases de datos.`,
    );

    return;
  }

  console.log(
    `Se procesarán ${databases.length} bases de datos.`,
  );

  let volumesMounted = false;

  try {
    /*
     * Los volúmenes se montan una sola vez para todas las bases.
     */
    await mountVolumes();
    volumesMounted = true;

    /*
     * Cada base se valida y procesa de forma independiente.
     *
     * Si una base no cumple las condiciones se omite y continúa
     * con la siguiente.
     */
    for (const database of databases) {
      try {
        await processDatabase(database);
      } catch (error) {
        console.error();
        console.error(
          redColor(`Falló el procesamiento de ${database}.`),
        );
        console.error(error);

        /*
         * Un error en una base no detiene las demás.
         */
        continue;
      }
    }
  } finally {
    /*
     * Los volúmenes se desmontan una sola vez al terminar.
     */
    if (volumesMounted) {
      await unmountVolumes();
    }
  }

  console.log();
  console.log(greenColor("Proceso de limpieza terminado."));
}

main().catch((error) => {
  console.error(redColor("Error inesperado durante la limpieza:"));
  console.error(error);
  process.exitCode = 1;
});
