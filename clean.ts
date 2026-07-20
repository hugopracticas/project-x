import { spawn } from "child_process";
import { readFile, appendFile } from "fs/promises";
import { existsSync } from "fs";
import { parseAllDocuments } from "yaml";
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// Configuración de IPs y Directorios
const NEW_BACKUP_DEVICE_IP = "10.207.12.40";
const NEW_BACKUP_DEVICE_DIRECTORY = "/mdbs_backup1";
const NEW_BACKUP_DEVICE = `${NEW_BACKUP_DEVICE_IP}:${NEW_BACKUP_DEVICE_DIRECTORY}`;

const OLD_BACKUP_DEVICE_IP = "10.207.12.26";
const OLD_BACKUP_DEVICE_DIRECTORY = "/vol/dbbackup_vol";
const OLD_BACKUP_DEVICE = `${OLD_BACKUP_DEVICE_IP}:${OLD_BACKUP_DEVICE_DIRECTORY}`;

const JUMP_HOST = "ssh1-den";
const TARGET_HOST = "den-r17-u14";

// Interfaz para el manejo del resultado de los comandos por SSH
interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

// Lee un archivo línea por línea omitiendo comentarios y líneas vacías
async function readLinesFromFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line: any) => line.trim())
    .filter((line: any) => line.length > 0)
    .filter((line: any) => !line.startsWith("#"));
}

// Colores para la terminal
function redColor(text: string) {
  return `\x1b[31m${text}\x1b[0m`;
}

function greeColor(text: string) { // Mantenido el nombre de la foto (greeColor)
  return `\x1b[32m${text}\x1b[0m`;
}

// Confirmación interactiva con el usuario
async function confirmWithY(message = "Continue? [y/N]: "): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(message);
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

// Ejecuta un comando de borrado recursivo seguro para carpetas o archivos
async function deleteFiles(filesToDelete: string[]): Promise<void> {
  for (const file of filesToDelete) {
    console.log(redColor(`Borrando permanentemente: ${file}`));
    // Cambiado a rm -rf para eliminar carpetas completas y su contenido
    const deleteScript = `rm -rf "${file}"`;
    await runBashOverDoubleSsh(JUMP_HOST, TARGET_HOST, deleteScript);
  }
}

/**Temporal funcion runBashOverDoubleSsh*/
function runBashOverDoubleSsh(
  jumpHost: string,
  targetHost: string,
  bashScript: string
): Promise<CommandResult> {
  return new Promise(async (resolve) => {
    try {
      // Ejecuta el script de Bash directamente en tu Ubuntu local usando /bin/bash
      const { stdout, stderr } = await execAsync(bashScript, { shell: '/bin/bash' });
      resolve({
        exitCode: 0,
        stdout,
        stderr
      });
    } catch (error: any) {
      resolve({
        exitCode: error.code ?? 1,
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? error.message
      });
    }
  });
}

//Conexión Local -> Jump Host -> Compute Node mediante Doble SSH con reintentos
// function runBashOverDoubleSsh(
//   jumpHost: string,
//   targetHost: string,
//   bashScript: string
// ): Promise<CommandResult> {
//   const maxRetries = 5;
//   const retryDelayMs = 3000;

//   const execute = (retryCount: number): Promise<CommandResult> => {
//     return new Promise((resolve, reject) => {
//       const child = spawn("ssh", [
//         "-A",
//         jumpHost,
//         "ssh",
//         targetHost,
//         "bash -s"
//       ], {
//         stdio: ["pipe", "pipe", "pipe"]
//       });

//       let stdout = "";
//       let stderr = "";

//       child.stdout.on("data", (data: any) => {
//         stdout += data.toString();
//       });

//       child.stderr.on("data", (data: any) => {
//         stderr += data.toString();
//       });

//       child.on("error", (error: any) => {
//         reject(error);
//       });

//       child.on("close", (code: any) => {
//         const normalizedStderr = stderr
//           .replace(/\r\n/g, "\n")
//           .trim();

//         const retryableError =
//           /kex_exchange_identification: read: Connection reset by peer|\nConnection reset by \S+ port 2222/;// Ajustado expresión regular del control

//         const shouldRetry = retryableError.test(normalizedStderr) && retryCount < maxRetries;

//         if (shouldRetry) {
//           console.warn(
//             `La conexión SSH fue reiniciada por el servidor. Reintento ${retryCount + 1} de ${maxRetries} en ${retryDelayMs} ms...`
//           );
//           setTimeout(() => {
//             execute(retryCount + 1)
//               .then(resolve)
//               .catch(reject);
//           }, retryDelayMs);
//           return;
//         }

//         resolve({
//           exitCode: code ?? 1,
//           stdout,
//           stderr
//         });
//       });

//       // Escribe el script Bash en la entrada estándar del proceso SSH
//       child.stdin.write(bashScript);
//       child.stdin.end();
//     });
//   };

//   return execute(0);
// }

// Función principal
async function main() {
  //let path_for_new_vol = "/home/egarciamaya/new_backup_path";
  //let path_for_old_vol = "/home/egarciamaya/old_backup_path";
  //Cambiar variables
  let path_for_new_vol = "/home/hugosh/Documents/Desarrollo/temp_db";
  let path_for_old_vol = "/home/hugosh/Documents/Desarrollo/temp_db";

  //Descomentar esto despues de pruebas
  let mountVolumesScript = `
  set -euo pipefail

  cd ~
  #mkdir -p \${path_for_new_vol}
  #mkdir -p \${path_for_old_vol}

  #sudo mount \${NEW_BACKUP_DEVICE} \${path_for_new_vol}
  #sudo mount \${OLD_BACKUP_DEVICE} \${path_for_old_vol}
  echo "Simulacion de montado local"
  `;

  let mountVolumesResult = await runBashOverDoubleSsh(JUMP_HOST, TARGET_HOST, mountVolumesScript);

  if (mountVolumesResult.stderr.trim()) {
    console.log("Volumenes no pudieron ser montados. Razón:");
    console.error(mountVolumesResult.stderr.trim());
  }

  if (mountVolumesResult.stdout.trim()) {
    console.log("Volumenes montados");
  }

  // Lectura del archivo de texto con las bases a procesar
  let bdNames = await readLinesFromFile('backups_to_be_deleted.txt');

  for (const bdName of bdNames) {
    console.log(`Checking ${greeColor(bdName)} backups...`);

    //Cambiar este codigo por el comentado
    let validateNewBackups = `
    set -euo pipefail

    # Inyectamos la variable de TS directamente (sin la barra invertida en path_for_new_vol)
    DB_PATH="${path_for_new_vol}/${bdName}"
    MIN_BACKUPS=10
    SECONDS=1209600

    SUB_PATHS=("5432/base" "5432.latest/base" "5432.latest_2/base")

    # Desactivamos el aborto inmediato y el fallo en tuberías para el listado permisivo
    # El signo de más (+) en Bash sirve para desactivar opciones. Al hacer esto, le dijimos a Bash: 
    # "Relájate. Si grep no encuentra un archivo en una carpeta, no te mueras; 
    #simplemente no imprimas nada en esa línea y continúa con la siguiente carpeta del ciclo for".
    set +e
    set +o pipefail

    for sub in "\${SUB_PATHS[@]}"; do
       # Validamos si el directorio existe antes de hacer ls para evitar errores fatales de Bash
       if [ -d "\$DB_PATH/\$sub" ]; then
          # Listamos lo que haya. Si no encuentra coincidencias, el "|| true" evita que el script muera
          ls -lh "\$DB_PATH/\$sub" | grep -E "successful|base\.tar\.gz" || true
       fi
    done

    # Volvemos a activar las políticas estrictas
    set -e
    set -o pipefail
    `;

    let findBackupPathsResult = await runBashOverDoubleSsh(JUMP_HOST, TARGET_HOST, validateNewBackups);

    if (findBackupPathsResult.stderr.trim()) {
      console.log(findBackupPathsResult.stderr.trim());
    }

    const outputText = findBackupPathsResult.stdout.trim();

    //Si no encuentras nada, muestra mensaje en rojo
    if (outputText === "") {
      console.log(`${redColor(bdName)} doesn't have 3 backups yet in ${NEW_BACKUP_DEVICE} volume`);
      console.log();
    } else {
      let backups = outputText.split("\n");

      // if (backups.length === 6) {
      //   console.log(`${bdName} has 3 successful backups in ${greeColor(NEW_BACKUP_DEVICE)} volume`);
      //   console.log(greeColor(outputText));

      //   // Calculamos la ruta raíz de esta base de datos específica
      //   //const carpetaPrincipalBD = `${path_for_new_vol}/${bdName}`;
      //   const carpetaPrincipalBD = path.resolve(`${path_for_new_vol}/${bdName}`);

      //   // Lanzamos la confirmación al usuario mostrando la ruta exacta a eliminar
      //   const procederBorrado = await confirmWithY(`¿La validación fue exitosa. Deseas proceder a borrar COMPLETAMENTE la carpeta ${carpetaPrincipalBD}? [y/N]: `);

      //   if (procederBorrado) {
      //     console.log(greeColor("\nIniciando el proceso de borrado completo..."));

      //     // Enviamos la carpeta principal en el arreglo
      //     await deleteFiles([carpetaPrincipalBD]);

      //     console.log(greeColor(`La carpeta ${carpetaPrincipalBD} y todo su contenido han sido eliminados.\n`));
      //   } else {
      //     console.log("Borrado cancelado por el usuario.");
      //   }

      // } 
      if (backups.length === 6) {
        console.log(`${bdName} has 3 successful backups in ${greeColor(NEW_BACKUP_DEVICE)} volume`);
        console.log(greeColor(outputText));

        // Mantenemos la construcción simple de la ruta
        const carpetaPrincipalBD = `${path_for_new_vol}/${bdName}`;

        const procederBorrado = await confirmWithY(`¿La validación fue exitosa. Deseas proceder a borrar COMPLETAMENTE la carpeta ${carpetaPrincipalBD}? [y/N]: `);

        if (procederBorrado) {
          console.log(greeColor("\nIniciando el proceso de borrado completo en el destino..."));

          const scriptBorradoSeguro = `
            set -euo pipefail
            
            # 1. Obtener la ruta absoluta real
            REAL_PATH=\$(readlink -f "${carpetaPrincipalBD}")
            VOL_PATH=\$(readlink -f "${path_for_new_vol}")
            
            # 2. PROTECCIÓN CRÍTICA: Jamás permitir borrar la raíz del sistema
            if [ -z "\$REAL_PATH" ] || [ "\$REAL_PATH" == "/" ]; then
              echo "ERROR DE SEGURIDAD: Intento de borrado de una ruta raíz inválida: \$REAL_PATH" >&2
              exit 1
            fi
            
            # 3. Caso especial para pruebas locales con (.)
            if [ "\$REAL_PATH" == "\$VOL_PATH" ]; then
              echo "Vaciando contenido del volumen raíz local de pruebas: \$REAL_PATH"
              rm -rf "\$REAL_PATH"/* "\$REAL_PATH"/.* 2>/dev/null || true
            else
              # Comportamiento normal en producción
              echo "Borrando carpeta de base de datos en el servidor: \$REAL_PATH"
              rm -rf "\$REAL_PATH"
            fi
          `;

          const resultadoBorrado = await runBashOverDoubleSsh(JUMP_HOST, TARGET_HOST, scriptBorradoSeguro);

          if (resultadoBorrado.stderr.trim()) {
            console.error(redColor(`\nError durante el borrado: ${resultadoBorrado.stderr.trim()}`));
          } else {
            console.log(greeColor(`\nLa carpeta ${carpetaPrincipalBD} ha sido eliminada con éxito en el entorno de destino.\n`));
          }
        } else {
          console.log("Borrado cancelado por el usuario.");
        }

      } else {
        console.log(`${redColor(bdName)} doesn't have all required backups (Found ${backups.length} of 6 files) in ${NEW_BACKUP_DEVICE} volume:`);
        console.log(redColor(outputText));
        console.log();
      }
    }
  }

  console.log();
  console.log();
  console.log();
}

// Ejecución del script
main().catch((error) => {
  console.error("Error inesperado:");
  console.error(error);
  process.exit(1);
});
