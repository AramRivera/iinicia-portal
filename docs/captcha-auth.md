# CAPTCHA en Supabase Auth

Cloudflare Turnstile protege el inicio de sesión con contraseña, el registro público y la solicitud de recuperación. Next.js obtiene el token del widget y lo envía como `captcha_token` a NestJS. Supabase Auth valida el desafío. En modo Managed, Turnstile puede validar automáticamente y mostrar un reto solo si hace falta. El login conserva su segundo paso TOTP y las rutas protegidas siguen exigiendo AAL2.

## Activación en el ambiente de pruebas

1. Crea un widget Turnstile en Cloudflare y autoriza el dominio del portal de pruebas.
2. Configura su clave pública en `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en la web. Reinicia Next.js en desarrollo o vuelve a compilar para el despliegue.
3. En Supabase, abre **Authentication → Attack Protection**, activa CAPTCHA y selecciona Turnstile. Guarda la clave secreta en Supabase. Coordina este cambio con el despliegue de la web y API, ya que Auth empezará a exigir el token en las operaciones protegidas.
4. Comprueba el registro, el acceso con contraseña seguido de TOTP y la solicitud de recuperación. En el ambiente de pruebas confirma también que Supabase rechaza solicitudes sin token o con uno vencido. El correo de recuperación requiere un proveedor de correo operativo.

La integración de código se encuentra en `codex/captcha-auth`. Se verificó la compilación de la API, 88 pruebas unitarias, 32 pruebas HTTP con servicios simulados y la comprobación de tipos de la web. Todavía no se ha configurado un widget real ni se ha probado Siteverify contra el proyecto Supabase. Los casos con mocks no validan credenciales externas.

Sin clave pública, la web omite el widget. Esto permite desarrollar contra un Supabase de pruebas con CAPTCHA desactivado. La protección efectiva depende de la configuración de Supabase Auth. Los tokens del widget se renuevan después de cada envío.

- [Configuración de CAPTCHA en Supabase](https://supabase.com/docs/guides/auth/auth-captcha)
- [Claves de prueba de Turnstile para ambientes aislados](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
