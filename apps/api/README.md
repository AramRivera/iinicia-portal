<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## IINICIA API

The API uses the `/api/v1` prefix. The permissions catalog is available at
`GET /api/v1/permissions`; it accepts `limit` (1–100, default 50), `offset`
(default 0), and an optional exact `code` filter. Responses contain `data` and
pagination metadata in `meta`. The shared contract is in `docs/openapi.yaml`.

### Health checks

Both health endpoints are public infrastructure probes and return
`Cache-Control: no-store`.

- `GET /api/v1/health` is liveness only; it returns `200` while the API process
  is responding and does not contact external services.
- `GET /api/v1/health/ready` checks the public Supabase programs endpoint through
  PostgREST and Supabase Auth. It returns `200` when both are reachable and
  `503` otherwise. Each request has a three-second timeout. The response only
  reports dependency availability; it does not include URLs, keys, response
  bodies, or exception details.

Try the endpoints locally:

```bash
curl -i http://localhost:3000/api/v1/health
curl -i http://localhost:3000/api/v1/health/ready
```

The readiness database probe selects only `id` from `public.programs`, whose
anonymous read access is intentionally allowed by the project RLS policy. It
does not use a secret/service-role key or read user data.

### Login desde Postman

Después de actualizar el código, ejecuta `npm ci` en `apps/api`.
Configura `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `PORT=3000` en `.env`,
y ejecuta `npm run start:dev`. No se necesita una clave secreta.

1. Crea un usuario confirmado en Supabase Authentication si todavía no existe.
2. Envía `POST http://localhost:3000/api/v1/auth/login` con Authorization **No Auth**,
   `Content-Type: application/json` y Body **raw / JSON**:

```json
{
  "email": "usuario@example.com",
  "password": "contraseña-del-usuario"
}
```

3. Copia `access_token` de la respuesta `200`.
4. Envía `GET http://localhost:3000/api/v1/permissions` usando Authorization
   **Bearer Token** con ese valor. Para ver el catálogo, el perfil debe estar activo
   y tener `roles.read`. El login no activa perfiles ni concede permisos.

El login devuelve `access_token`, `refresh_token`, `token_type`, `expires_in`,
`expires_at` (si Supabase lo proporciona) y `user` con `id` y `email`.
No almacena sesiones en el servidor ni registra contraseñas o tokens.
Errores: `400` por cuerpo inválido, `401` por credenciales rechazadas,
`429` por exceso de intentos y `503` por fallos del servicio externo.
El límite local es de 5 solicitudes por minuto por IP, en memoria por proceso;
se reinicia al reiniciar la API. Antes de desplegar varias instancias, utiliza
almacenamiento compartido para el límite y configura únicamente proxies de confianza.
Usa HTTPS fuera de localhost. No se añade un endpoint de renovación en este cambio;
para esta prueba, inicia sesión nuevamente cuando venza el access token.

### Supabase access decision

| Strategy              | Security and operational impact                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User JWT + RLS        | PostgreSQL evaluates each query as the authenticated user. The `permissions` RLS policy requires `roles.read`; this is the selected strategy for this read endpoint.                           |
| Privileged server key | Bypasses RLS. NestJS would need to verify the active user and `roles.read` permission itself. Not used by this endpoint.                                                                       |
| Mixed                 | Can use JWT + RLS for user-scoped reads and a privileged key for operations that require it, with explicit authorization for every privileged operation. This endpoint does not need that key. |

The API verifies the Bearer token with Supabase Auth and passes it through to
PostgREST so that the database applies RLS. Set `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` in `apps/api/.env`; use `.env.example` as a template.
Do not use the secret/service-role key for this endpoint.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
