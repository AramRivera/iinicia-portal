# Programación literaria de IINICIA

El recorrido empieza con la sesión del usuario, pasa por las reglas de la API y termina en los permisos de los datos. Los capítulos reúnen las explicaciones y el código en bloques con nombre. Cada bloque corresponde a un archivo que puede reconstruirse en su ruta original.

## Lectura del proyecto

| Capítulo | Cómo seguir el código |
| --- | --- |
| [API y pruebas](literaria/api.md) | Empieza en `main.ts` y `app.module.ts`. Sigue los guards de `common/auth`, los controladores HTTP y sus servicios. Consulta las pruebas de cada módulo para ver qué contratos se comprueban. |
| [Portal y pruebas](literaria/web.md) | Empieza en `layout.tsx` y `page.tsx`. Sigue la sesión en `AuthContext` y las solicitudes en `lib/api.ts`. El navegador usa los resultados para mostrar los paneles y abrir el campus. |
| [Datos, contratos e infraestructura](literaria/infraestructura.md) | Lee las migraciones en orden de fecha. Consulta las pruebas SQL para entender cómo se aplica el alcance de cada rol y el contrato OpenAPI para ver qué recibe y devuelve la API. |

Por ejemplo, al abrir Moodle, el portal pide un enlace a la API. El controlador verifica la sesión y el servicio obtiene la URL según el acceso autorizado. El cliente Moodle valida el origen del inicio de sesión y el navegador comprueba también que el destino final quede dentro del campus.

## Editar y reconstruir

Los comentarios dentro de los archivos fuente explican las decisiones de permisos, sesión, diagnósticos e integraciones junto a la lógica que las aplica. Al sincronizar los capítulos, esos comentarios quedan incluidos en cada bloque y se conservan al reconstruir los archivos.

Los manifiestos y contratos JSON tienen una explicación junto a su bloque en el capítulo. El bloque conserva el formato válido que leen npm, TypeScript y OpenAPI.

Los capítulos incluyen el código y la configuración textual de las aplicaciones, las pruebas, los scripts propios, el esquema, las migraciones, Docker y OpenAPI. El repositorio aporta aparte los archivos binarios, los lockfiles generados y las dependencias externas. Las variables privadas se configuran por entorno.

Desde la raíz de Git y con Node.js disponible:

```powershell
node scripts/literate.mjs verify
node scripts/literate.mjs extract C:/ruta/nueva/iinicia-fuentes
```

Si editas un capítulo, extrae los bloques a una carpeta nueva y revisa la diferencia antes de incorporar los archivos al proyecto. Si los archivos de trabajo cambian primero, ejecuta `node scripts/literate.mjs sync` para actualizar sus capítulos. El verificador compara todos los bloques con los archivos de trabajo y admite finales de línea de Windows y Unix.

Consulta los hallazgos y resultados de esta entrega en [Revisión de seguridad y pruebas](revision-seguridad-20261123.md).
