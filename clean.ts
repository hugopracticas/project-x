import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);


async function validarRespaldos() {

  let verificarTodo = `
  # Definición de la función de validación
  validar_antiguedad_respaldos() {
    # Recibe los parámetros obligatorios
    local base_dir="$1"
    local minimo_archivos="$2"
    local segundos_antiguedad="$3"
    
    local subcarpetas=("5432" "5432.latest" "5432.latest_2")
    local sub conteo fecha_archivo fecha_actual diferencia

    # 1. Validamos que la estructura de carpetas exista
    for sub in "\${subcarpetas[@]}"; do
        if [ ! -d "$base_dir/$sub" ]; then  
            echo "false"
            return 1
        fi
    done

    # 2. Validamos que cada una tenga al menos el número de archivos solicitado
    for sub in "\${subcarpetas[@]}"; do
        conteo=\$(find "$base_dir/$sub" -maxdepth 1 -type f -name "*.gz" | wc -l)
        if [ "$conteo" -lt "$minimo_archivos" ]; then
            echo "false"
            return 1
        fi
    done

    # 3. Buscamos el epoch del archivo más antiguo de forma limpia
    fecha_archivo=\$(find "$base_dir" -type f -name "*.gz" -printf "%T@\\n" | sort | head -n 1 | cut -d. -f1)
    
    if [ -z "$fecha_archivo" ]; then
        echo "false"
        return 1
    fi

    fecha_actual=\$(date +%s)
    diferencia=\$((fecha_actual - fecha_archivo))

    # 4. Respondemos si es mayor al tiempo solicitado
    if [ "$diferencia" -gt "$segundos_antiguedad" ]; then
        echo "true"
        return 0
    else
        echo "false"
        return 1
    fi
  }

  RUTA_COMPROBACION="/home/hugosh/Documents/Desarrollo/temp_db/"
  MINIMO_RESPALDOS=3
  SEGUNDOS_LIMITE=45 # 24 horas

  # Invocación capturando el texto (true/false)
  resultado=\$(validar_antiguedad_respaldos "$RUTA_COMPROBACION" "$MINIMO_RESPALDOS" "$SEGUNDOS_LIMITE")

  echo "\$resultado"
  `;

  try {
    // Forzamos a Node a usar /bin/bash pasándole la opción shell
    const respuesta = (await execAsync(verificarTodo, { shell: '/bin/bash' })).stdout.trim();
    console.log(respuesta);
    return respuesta === "true";
  } catch (error) {
    console.error(`Error al ejecutar la validación en:`, error);
    return null;
  }
}


async function main() {


  //const miHome = process.env.HOME || '';
  //const rutaProyecto = `${miHome}/Documents/Desarrollo/temp_db`;

  //console.log("--- Ejecutando Prueba 1: 3 archivos, 14 días (2 semanas) ---");
  await validarRespaldos();

  // console.log("\n--- Ejecutando Prueba 2: 5 archivos, 30 días (1 mes) ---");
  // await validarRespaldos(rutaProyecto, 5, 30);

}


main().catch((error) => {
  console.error("Error");
  console.error(error);
  process.exit(1);
})
