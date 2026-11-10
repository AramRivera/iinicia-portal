# Verificación en dos pasos

El portal usa TOTP de Supabase Auth para todos los roles. Después de validar la contraseña, la primera entrada permite escanear un QR o introducir la clave en una app autenticadora. A partir del siguiente inicio de sesión se solicita el código actual de seis dígitos. El flujo TOTP funciona sin SMTP. [Guía de TOTP de Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp)

## Contrato y controles

1. `POST /api/v1/auth/login` devuelve `step: setup` si la cuenta necesita configurar su autenticador, o `step: verify` si ya tiene un TOTP verificado. En ambos casos devuelve `mfa_token`, un JWT provisional `aal1`. El navegador lo mantiene en memoria junto con los datos de configuración.
2. `POST /api/v1/auth/mfa/verify` recibe `Authorization: Bearer <mfa_token>` y `{"factor_id":"<UUID>","code":"012345"}`. NestJS valida que la cuenta pueda usar el factor, crea el desafío y envía el código a Supabase. Solo acepta la sesión resultante si Supabase confirma `aal2` para esa identidad. El portal carga el perfil antes de guardar el token de acceso y abrir el panel.
3. Las rutas protegidas comprueban `aal2` en el JWT después de verificarlo con Supabase. Un token `aal1` devuelve `403`. Un token inválido o ausente devuelve `401`. Las rutas de verificación tienen un límite de cinco solicitudes por minuto por IP y las respuestas de autenticación usan `Cache-Control: no-store`.
4. El restablecimiento por correo solicita el código de un TOTP ya registrado cuando corresponde. En ese caso, `/auth/reset-password` devuelve `step: verify` y `/auth/mfa/recover` confirma el código antes de actualizar la contraseña. Después, el usuario inicia sesión con la contraseña nueva y el autenticador. El soporte debe verificar la identidad de quien perdió su autenticador antes de resolver el acceso por un procedimiento administrativo.

El contrato de `POST /auth/login` cambia. Actualiza los clientes de API y el portal junto con NestJS. Una sesión anterior `aal1` volverá al inicio de sesión al intentar restaurar su perfil. El navegador conserva una sesión `aal2` vigente al recargar la página. Consulta [OpenAPI](openapi.yaml).

## Preparar el entorno de entrega

1. En Supabase Auth, verifica que TOTP permita **Enrollment** y **Verification**. El portal admite autenticadores TOTP. Si una cuenta ya tiene únicamente otro tipo de factor, debe resolver su configuración con soporte antes de entrar.
2. Revisa y aplica en el entorno autorizado la migración `20261110120000_require_mfa_data_api.sql`. PostgREST ejecuta la comprobación antes de cada petición y rechaza a `authenticated` con un JWT distinto de `aal2`, incluso en RPC y vistas. Las políticas RLS y los permisos existentes siguen determinando el acceso para `aal2`. Las peticiones públicas y el rol de servicio conservan sus propias reglas. Si existe otro `pgrst.db_pre_request`, la migración se detiene para integrar ambos controles. Si el proyecto usa otro producto de Supabase para datos protegidos, comprueba la exigencia de MFA en sus políticas correspondientes. [Migración](../supabase/migrations/20261110120000_require_mfa_data_api.sql) · [Pre-request de Supabase](https://supabase.com/docs/guides/api/securing-your-api)
3. Prueba con una cuenta de cada tipo de acceso, incluyendo una de administración. Confirma que el código inválido deja el portal cerrado, que el código válido abre el panel y que tras cerrar sesión el siguiente ingreso vuelve a pedir un código. Comprueba `403` con `aal1` en `/auth/me` y en una tabla a la que esa cuenta sí tiene acceso con `aal2`.
4. Con el correo de pruebas habilitado, abre un enlace de recuperación, confirma que se pide el autenticador y verifica el cambio y el inicio posterior. Registra el resultado sin incluir códigos, tokens o claves.

## Evidencia de desarrollo

El 10 de noviembre de 2026 se probó con Supabase Auth `v2.197.0`, PostgREST `v14.6` y PostgreSQL 16 en contenedores locales. Se comprobó la reanudación de un alta abandonada, el QR, el rechazo del código incorrecto, la verificación en dos inicios y la denegación de AAL1 tanto en NestJS como en la Data API. También se probaron el enlace con `token_hash` y el enlace PKCE capturado con Mailpit. Ambos exigieron TOTP para cambiar la contraseña. La configuración del Supabase del proyecto se valida por separado.

La API compiló y pasaron `npm test` (88 pruebas) y `npm run test:e2e` (31 pruebas HTTP con servicios simulados). El portal compiló con `npm run build`. El lint de las páginas de inicio y recuperación pasó. `AuthContext.tsx` conserva el error y el aviso de lint que ya presentaba la versión base.
