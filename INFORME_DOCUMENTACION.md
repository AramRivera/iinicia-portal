# Informe de documentación del código

23 de noviembre de 2026. Trabajo sobre el árbol local de `main`, con base en `6f17bd8`. La referencia para la comparación incluye los cambios locales de seguridad, suites y capítulos que existían al comenzar.

## Alcance y cobertura

El inventario contiene **445 archivos** versionados o nuevos sin ignorar que existían al comenzar. Se clasificaron sus rutas y se revisó el código propio elegible para comentarios.

| Estado | Archivos |
| --- | ---: |
| Código propio elegible para comentarios | 194 |
| Código propio con comentarios comprobados | 194 |
| Configuraciones documentadas en la guía | 12 |
| Excluidos de la intervención en código | 239 |

La comprobación encontró documentación JSDoc en **349 declaraciones** de funciones con cuerpo, métodos, constructores, accesores y funciones asignadas a una variable de módulo. Los callbacks pequeños se explican en su bloque principal cuando forman parte de una sola operación. Se agregaron 474 bloques o cabeceras de comentario en español. El inventario de abajo identifica los archivos de configuración que requieren explicación externa.

La revisión conserva los recursos gráficos, las dependencias, los lockfiles, el material HTML compactado de distribución, los volcados o copias generados y los recursos auxiliares de herramientas. Las carpetas ignoradas de dependencias y compilación y los archivos privados del entorno quedan fuera del inventario. Los capítulos Markdown se regeneraron desde las fuentes comentadas.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Integridad textual | Se comprobó que retirar solo las inserciones de comentario restaura el contenido exacto de los 194 archivos de la captura inicial. |
| Sintaxis JS y TS | La salida del analizador de TypeScript sin comentarios es idéntica antes y después en 161 archivos. |
| Pruebas unitarias de la API | 152 aprobaron antes y después. |
| Pruebas HTTP de la API | 39 aprobaron antes y después. |
| Pruebas de la web | 3 aprobaron antes y después. |
| Compilación y tipos | NestJS compiló y Next.js compiló y generó 25 páginas antes y después. |
| Linter API | Terminó con 3 advertencias de tipos o variables sin usar. |
| Linter web | Devuelve 79 errores y 37 advertencias. En 50 archivos se comprobó que las reglas, severidades y cantidades de diagnósticos coinciden antes y después. |
| Migraciones y políticas SQL | En una base desechable PGlite se aplicaron la línea base, las dos migraciones posteriores y los datos de prueba. Pasaron `staff_scope.sql` y `client_privileges.sql`. |
| Capítulos | `node scripts/literate.mjs verify` confirmó los 203 bloques reconstruibles. |
| Diff | `git diff --check` pasó. |

Los comentarios describen las decisiones en sus módulos responsables. En la guía se vinculan los pasos entre módulos y se explican los formatos que no admiten comentarios. La comparación sintáctica y la reconstrucción comprueban integridad y cobertura de declaraciones. El criterio de claridad de los comentarios sigue siendo editorial. Las dependencias externas se simulan en las pruebas HTTP y la verificación de servicios reales queda fuera de esta revisión documental.

## Inventario individual

| Ruta | Propósito | Estado |
| --- | --- | --- |
| `.agents/skills/apple-design/AGENTS.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/GEMINI.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/README.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/SKILL.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/code-audit.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/cross-platform.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig-lookup.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/accessibility.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/action-sheets.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/activity-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/airplay.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/alerts.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/app-clips.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/app-icons.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/app-shortcuts.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/apple-in-app-purchase.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/apple-pay.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/apple-pencil-and-scribble.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/augmented-reality.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/boxes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/branding.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/buttons.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/charting-data.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/charts.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/collaboration-and-sharing.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/collections.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/color-wells.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/color.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/column-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/combo-boxes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/context-menus.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/controls.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/dark-mode.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/design-principles.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/designing-for-games.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/designing-for-ios.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/designing-for-ipados.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/designing-for-iphone-duo.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/designing-for-macos.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/disclosure-controls.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/dock-menus.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/drag-and-drop.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/edit-menus.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/entering-data.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/feedback.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/file-management.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/focus-and-selection.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/game-controls.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/gauges.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/generative-ai.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/gestures.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/going-full-screen.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/gyro-and-accelerometer.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/home-screen-quick-actions.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/icloud.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/icons.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/image-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/image-wells.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/images.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/inclusion.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/keyboards.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/labels.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/launching.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/layout.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/liquid-glass.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/lists-and-tables.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/live-activities.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/live-viewing-apps.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/loading.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/machine-learning.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/managing-accounts.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/managing-notifications.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/maps.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/materials.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/menus.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/modality.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/motion.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/multitasking.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/nfc.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/notifications.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/offering-help.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/onboarding.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/outline-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/page-controls.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/panels.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/path-controls.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/pickers.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/playing-audio.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/playing-haptics.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/playing-video.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/pointing-devices.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/pop-up-buttons.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/popovers.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/printing.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/privacy.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/progress-indicators.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/pull-down-buttons.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/rating-indicators.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/ratings-and-reviews.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/right-to-left.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/scroll-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/search-fields.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/searching.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/segmented-controls.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/settings.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/sf-symbols.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/sheets.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/sidebars.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/sign-in-with-apple.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/siri.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/sliders.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/snippets.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/split-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/status-bars.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/steppers.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/tab-bars.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/tab-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/text-fields.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/text-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/the-menu-bar.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/toggles.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/token-fields.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/toolbars.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/typography.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/undo-and-redo.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/virtual-keyboards.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/voiceover.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/web-views.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/widgets.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/windows.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/references/hig/writing.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/apple-design/scripts/pull-hig.mjs` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/CHANGELOG.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/SKILL.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/_contributing.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/_sections.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/_template.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/conn-limits.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/conn-pooling.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/data-pagination.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/data-upsert.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/lock-advisory.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/query-index-types.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/schema-constraints.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/schema-data-types.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/security-privileges.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase/CHANGELOG.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase/SKILL.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase/assets/feedback-issue-template.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.agents/skills/supabase/references/skill-feedback.md` | Recurso de herramientas o documentación auxiliar en .agents. | Excluido |
| `.gitignore` | Configura el seguimiento y el tratamiento local de archivos en Git. | Comentarios en código |
| `AGENTS.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `ALCANCE.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `Proyecto_Rediseno_Migracion_Portal_IINICIA_React_Moodle.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `README.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `apps/api/.dockerignore` | Controla la construcción y el contexto de la imagen del servicio. | Comentarios en código |
| `apps/api/.env.example` | Plantilla de parámetros del servidor y sus integraciones. | Guía externa |
| `apps/api/.gitattributes` | Configura el seguimiento y el tratamiento local de archivos en Git. | Comentarios en código |
| `apps/api/.oxlintrc.json` | Reglas del análisis estático de la API. | Guía externa |
| `apps/api/.prettierrc` | Reglas de formato en el archivo de configuración de Prettier. | Guía externa |
| `apps/api/Dockerfile` | Compila NestJS en una etapa separada y prepara la imagen que ejecuta la API. | Comentarios en código |
| `apps/api/README.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `apps/api/db/1100_sessions_password_changed_at.sql` | Migración incremental e idempotente para un proyecto que ya tiene | Comentarios en código |
| `apps/api/db/IINICIA_DATABASE.sql` | ARQUITECTURA: Next.js + NestJS + Supabase (PostgreSQL 15+) + Moodle LMS | Comentarios en código |
| `apps/api/db/README.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `apps/api/db/bootstrap_superadmin.sql` | Crear el PRIMER superadministrador (se corre una sola vez, en el SQL Editor) | Comentarios en código |
| `apps/api/db/datos_de_prueba.sql` | SEED DE DATOS DE PRUEBA · IINICIA · Supabase (DEV) - CORREGIDO | Comentarios en código |
| `apps/api/db/iinicia_schema_completo.sql` | Búsqueda difusa de usuarios (panel administrativo) | Comentarios en código |
| `apps/api/db/mostrar_datos_correto.sql` | INSPECCIÓN RÁPIDA · IINICIA · Supabase (DEV) | Comentarios en código |
| `apps/api/db/seed.sql` | HISTÓRICO: semilla SOLO DEV, no ejecutar como configuración del proyecto. | Comentarios en código |
| `apps/api/nest-cli.json` | Entrada y opciones de compilación de NestJS. | Guía externa |
| `apps/api/package-lock.json` | Lockfile generado por npm. | Excluido |
| `apps/api/package.json` | Comandos y dependencias de la API. | Guía externa |
| `apps/api/src/app.controller.spec.ts` | Comprueba la respuesta de bienvenida del controlador raíz aislado. | Comentarios en código |
| `apps/api/src/app.controller.ts` | Sirve el punto de entrada y las versiones del contrato OpenAPI que consume Swagger. | Comentarios en código |
| `apps/api/src/app.module.ts` | Ensambla los módulos de identidad, gestión académica, Moodle y contenido institucional. | Comentarios en código |
| `apps/api/src/app.service.ts` | Centraliza el mensaje devuelto por el endpoint raíz. | Comentarios en código |
| `apps/api/src/common/auth/current-user.decorator.ts` | Obtiene del contexto HTTP la identidad que ya colocó el guard de autenticación. | Comentarios en código |
| `apps/api/src/common/auth/permissions.decorator.ts` | Adjunta a la ruta los permisos que interpreta PermissionsGuard. | Comentarios en código |
| `apps/api/src/common/auth/permissions.guard.ts` | Resuelve los permisos requeridos por la ruta y los compara con los permisos de la sesión. | Comentarios en código |
| `apps/api/src/common/auth/program-scope.ts` | Centraliza las comprobaciones de ámbito académico para roles globales y coordinadores. | Comentarios en código |
| `apps/api/src/common/auth/roles.decorator.ts` | Declara los roles aceptados por una ruta y normaliza alias para compararlos. | Comentarios en código |
| `apps/api/src/common/auth/roles.guard.spec.ts` | Comprueba acceso sin restricción, coincidencia de roles y denegación cuando no existe asignación. | Comentarios en código |
| `apps/api/src/common/auth/roles.guard.ts` | Exige los roles de la ruta y resuelve sus asignaciones vigentes para el usuario autenticado. | Comentarios en código |
| `apps/api/src/common/auth/staff-hierarchy.spec.ts` | Ejercita las reglas de jerarquía por separado para que los permisos de administración ordinaria y global conserven sus límites. | Comentarios en código |
| `apps/api/src/common/auth/staff-hierarchy.ts` | La administración de cuentas tiene un límite adicional al permiso de la ruta. Antes de modificar usuarios o asignar roles, se compara su jerarquía con la de quien ejecuta la operación. | Comentarios en código |
| `apps/api/src/common/auth/supabase-auth.guard.spec.ts` | Comprueba el rechazo de tokens inválidos, de sesiones sin MFA y de peticiones sin Bearer. | Comentarios en código |
| `apps/api/src/common/auth/supabase-auth.guard.ts` | Valida la identidad con Supabase y exige el segundo factor antes de entregar la petición al controlador. | Comentarios en código |
| `apps/api/src/common/auth/supabase-token-claims.ts` | Lee los atributos del JWT para que otros componentes interpreten la sesión validada. | Comentarios en código |
| `apps/api/src/common/supabase/database.types.ts` | Describe las tablas, vistas, funciones y estados que usa el cliente tipado de Supabase. | Comentarios en código |
| `apps/api/src/common/supabase/supabase-login.spec.ts` | Ejercita el inicio de sesión con contraseña, el desafío TOTP y el uso del token de usuario. | Comentarios en código |
| `apps/api/src/common/supabase/supabase-recovery.spec.ts` | Cubre los enlaces de recuperación, el intercambio PKCE y la verificación de TOTP antes del cambio de contraseña. | Comentarios en código |
| `apps/api/src/common/supabase/supabase-resilient-client.spec.ts` | Comprueba que el cliente REST preserve el token del usuario y los errores de PostgREST. | Comentarios en código |
| `apps/api/src/common/supabase/supabase-signup.spec.ts` | Cubre el registro sin sesión inmediata y la selección segura del destino de confirmación. | Comentarios en código |
| `apps/api/src/common/supabase/supabase.module.ts` | Registra el servicio de Supabase para compartirlo entre los módulos de NestJS. | Comentarios en código |
| `apps/api/src/common/supabase/supabase.service.ts` | Separa las operaciones de identidad, las consultas bajo RLS y las acciones privilegiadas con Supabase. | Comentarios en código |
| `apps/api/src/main.ts` | Configura el servidor HTTP, el prefijo de la API, CORS y la validación de las solicitudes. | Comentarios en código |
| `apps/api/src/modules/admissions/admissions.controller.ts` | Expone por HTTP la bandeja por rol, la creación de postulaciones y el dictamen con matrícula inicial. | Comentarios en código |
| `apps/api/src/modules/admissions/admissions.module.ts` | Registra el controlador y los proveedores de postulaciones y dictámenes de admisión en NestJS. | Comentarios en código |
| `apps/api/src/modules/admissions/admissions.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe filtrar postulaciones por ámbito y promover al aspirante después del dictamen. | Comentarios en código |
| `apps/api/src/modules/admissions/admissions.service.ts` | Implementa las reglas para filtrar postulaciones por ámbito y promover al aspirante después del dictamen. | Comentarios en código |
| `apps/api/src/modules/admissions/dto/create-admission.dto.ts` | Valida el programa y los datos enviados por el aspirante al postularse. | Comentarios en código |
| `apps/api/src/modules/admissions/dto/review-admission.dto.ts` | Valida el estado y los datos del dictamen enviado al revisar una postulación. | Comentarios en código |
| `apps/api/src/modules/audit/audit.controller.ts` | Expone por HTTP la lectura paginada de eventos administrativos. | Comentarios en código |
| `apps/api/src/modules/audit/audit.module.ts` | Registra el controlador y los proveedores de consulta de la bitácora en NestJS. | Comentarios en código |
| `apps/api/src/modules/audit/audit.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe aplicar filtros por actor, acción y entidad sobre eventos visibles para la sesión. | Comentarios en código |
| `apps/api/src/modules/audit/audit.service.ts` | Implementa las reglas para aplicar filtros por actor, acción y entidad sobre eventos visibles para la sesión. | Comentarios en código |
| `apps/api/src/modules/audit/dto/query-audit.dto.ts` | Define los filtros y límites de paginación aceptados por la consulta de auditoría. | Comentarios en código |
| `apps/api/src/modules/auth/auth.controller.ts` | Expone por HTTP registro, inicio de sesión con TOTP, recuperación y consulta del perfil propio. | Comentarios en código |
| `apps/api/src/modules/auth/auth.module.ts` | Registra el controlador y los proveedores de identidad, sesión y perfil del usuario en NestJS. | Comentarios en código |
| `apps/api/src/modules/auth/auth.repository.ts` | Carga el perfil propio y sus roles y permisos respetando el alcance de la sesión. | Comentarios en código |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe coordinar el registro y construir el perfil de sesión con roles y permisos. | Comentarios en código |
| `apps/api/src/modules/auth/auth.service.ts` | Implementa las reglas para coordinar el registro y construir el perfil de sesión con roles y permisos. | Comentarios en código |
| `apps/api/src/modules/auth/dto/login.dto.ts` | Valida el correo, la contraseña y la prueba CAPTCHA que recibe el inicio de sesión. | Comentarios en código |
| `apps/api/src/modules/auth/dto/me-response.dto.ts` | Describe el perfil, los roles y los permisos que consume la sesión del portal. | Comentarios en código |
| `apps/api/src/modules/auth/dto/password-recovery.dto.ts` | Valida las variantes de solicitud, intercambio y restablecimiento de contraseña. | Comentarios en código |
| `apps/api/src/modules/auth/dto/register.dto.ts` | Define los datos de identidad y contacto que admite el registro público. | Comentarios en código |
| `apps/api/src/modules/auth/dto/verify-login-mfa.dto.ts` | Valida la referencia al factor y el código TOTP del segundo paso. | Comentarios en código |
| `apps/api/src/modules/cms/cms.controller.ts` | Expone por HTTP contenido público, directorio, formulario de contacto y mapa de redirecciones. | Comentarios en código |
| `apps/api/src/modules/cms/cms.module.ts` | Registra el controlador y los proveedores de contenido institucional y migración de WordPress en NestJS. | Comentarios en código |
| `apps/api/src/modules/cms/cms.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe consultar contenido publicado y recibir mensajes desde el portal. | Comentarios en código |
| `apps/api/src/modules/cms/cms.service.ts` | Implementa las reglas para consultar contenido publicado y recibir mensajes desde el portal. | Comentarios en código |
| `apps/api/src/modules/cms/dto/create-contact-message.dto.ts` | Valida los datos de contacto y el contenido del mensaje institucional. | Comentarios en código |
| `apps/api/src/modules/courses/courses.controller.ts` | Expone por HTTP oferta, cursos autorizados y administración de equivalencias. | Comentarios en código |
| `apps/api/src/modules/courses/courses.module.ts` | Registra el controlador y los proveedores de oferta académica y equivalencias con Moodle en NestJS. | Comentarios en código |
| `apps/api/src/modules/courses/courses.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe distinguir la oferta de los cursos autorizados y mantener su vínculo con Moodle. | Comentarios en código |
| `apps/api/src/modules/courses/courses.service.ts` | Implementa las reglas para distinguir la oferta de los cursos autorizados y mantener su vínculo con Moodle. | Comentarios en código |
| `apps/api/src/modules/courses/dto/create-course-mapping.dto.ts` | Valida la relación entre un curso Moodle y su publicación en el portal. | Comentarios en código |
| `apps/api/src/modules/courses/dto/update-course-mapping.dto.ts` | Valida los campos editables de una equivalencia con Moodle. | Comentarios en código |
| `apps/api/src/modules/enrollments/dto/create-enrollment-request.dto.ts` | Define los identificadores y el rol académico aceptados al solicitar una matrícula. | Comentarios en código |
| `apps/api/src/modules/enrollments/dto/update-enrollment-status.dto.ts` | Valida el nuevo estado de la matrícula y la información asociada a la revisión. | Comentarios en código |
| `apps/api/src/modules/enrollments/enrollments.controller.ts` | Expone por HTTP solicitud, autorización, sincronización y baja de matrículas. | Comentarios en código |
| `apps/api/src/modules/enrollments/enrollments.module.ts` | Registra el controlador y los proveedores de solicitudes y matrículas académicas en NestJS. | Comentarios en código |
| `apps/api/src/modules/enrollments/enrollments.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe controlar las transiciones locales y coordinar las operaciones remotas en Moodle. | Comentarios en código |
| `apps/api/src/modules/enrollments/enrollments.service.ts` | Implementa las reglas para controlar las transiciones locales y coordinar las operaciones remotas en Moodle. | Comentarios en código |
| `apps/api/src/modules/health/health.controller.ts` | Expone por HTTP el estado de la API, Supabase y Moodle. | Comentarios en código |
| `apps/api/src/modules/health/health.module.ts` | Registra el controlador y los proveedores de diagnóstico de las integraciones en NestJS. | Comentarios en código |
| `apps/api/src/modules/health/health.service.ts` | Implementa las reglas para comprobar las dependencias y resumir su disponibilidad. | Comentarios en código |
| `apps/api/src/modules/help-chat/help-chat.controller.ts` | La entrada pública del chat limita el tamaño de la pregunta, la cantidad de contexto y la frecuencia antes de llamar al proveedor. | Comentarios en código |
| `apps/api/src/modules/help-chat/help-chat.module.ts` | Registra por separado el controlador público del chat y el servicio que consulta al proveedor de respuestas. | Comentarios en código |
| `apps/api/src/modules/help-chat/help-chat.service.spec.ts` | Simula el proveedor del chat para comprobar qué contexto se envía y cómo se interpretan las referencias devueltas. | Comentarios en código |
| `apps/api/src/modules/help-chat/help-chat.service.ts` | El chat recupera material de IINICIA para orientar la respuesta. A partir del resultado, el servidor reconstruye enlaces usando el catálogo local. | Comentarios en código |
| `apps/api/src/modules/help-chat/help-knowledge.ts` | El catálogo de ayuda une cada tema del portal a un destino conocido. El servicio utiliza sus identificadores para adjuntar enlaces que controla IINICIA. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.client.spec.ts` | Simula Moodle para comprobar el transporte del token, la validación de destinos y la reutilización de consultas de disponibilidad. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.client.ts` | Traduce las operaciones de integración a Web Services de Moodle y procesa sus respuestas. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.controller.ts` | Expone por HTTP sincronización, acceso al campus y consultas académicas. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.module.ts` | Registra el controlador y los proveedores de integración con el aula virtual en NestJS. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe enlazar identidades, sincronizar matrículas y controlar el acceso académico. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.service.ts` | Implementa las reglas para enlazar identidades, sincronizar matrículas y controlar el acceso académico. | Comentarios en código |
| `apps/api/src/modules/moodle/moodle.types.ts` | Describe usuarios, cursos, estados de finalización y errores devueltos por Moodle. | Comentarios en código |
| `apps/api/src/modules/permissions/dto/query-permissions.dto.spec.ts` | Comprueba la normalización y validación de la consulta paginada de permisos. | Comentarios en código |
| `apps/api/src/modules/permissions/dto/query-permissions.dto.ts` | Normaliza los parámetros de paginación del catálogo de permisos. | Comentarios en código |
| `apps/api/src/modules/permissions/permissions.controller.ts` | Expone por HTTP el catálogo paginado de permisos. | Comentarios en código |
| `apps/api/src/modules/permissions/permissions.module.ts` | Registra el controlador y los proveedores de catálogo de permisos en NestJS. | Comentarios en código |
| `apps/api/src/modules/permissions/permissions.repository.ts` | Consulta y pagina los permisos con el cliente de datos asociado a la sesión. | Comentarios en código |
| `apps/api/src/modules/permissions/permissions.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe entregar el catálogo con metadatos de paginación. | Comentarios en código |
| `apps/api/src/modules/permissions/permissions.service.ts` | Implementa las reglas para entregar el catálogo con metadatos de paginación. | Comentarios en código |
| `apps/api/src/modules/programs/dto/assign-user-program.dto.ts` | Valida el usuario y los datos académicos de la adscripción a un programa. | Comentarios en código |
| `apps/api/src/modules/programs/dto/create-program.dto.ts` | Valida los datos académicos y de publicación de un programa nuevo. | Comentarios en código |
| `apps/api/src/modules/programs/dto/update-program.dto.ts` | Valida los cambios parciales en la información de un programa. | Comentarios en código |
| `apps/api/src/modules/programs/programs.controller.ts` | Expone por HTTP catálogo, edición y asignación de usuarios a programas. | Comentarios en código |
| `apps/api/src/modules/programs/programs.module.ts` | Registra el controlador y los proveedores de programas académicos y adscripciones en NestJS. | Comentarios en código |
| `apps/api/src/modules/programs/programs.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe distinguir el catálogo público de la gestión administrativa por ámbito. | Comentarios en código |
| `apps/api/src/modules/programs/programs.service.ts` | Implementa las reglas para distinguir el catálogo público de la gestión administrativa por ámbito. | Comentarios en código |
| `apps/api/src/modules/roles/dto/assign-role.dto.ts` | Valida el identificador del rol y la información de la asignación. | Comentarios en código |
| `apps/api/src/modules/roles/roles.controller.ts` | Expone por HTTP consulta, asignación y revocación de roles. | Comentarios en código |
| `apps/api/src/modules/roles/roles.module.ts` | Registra el controlador y los proveedores de catálogo y asignación de roles en NestJS. | Comentarios en código |
| `apps/api/src/modules/roles/roles.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe aplicar la jerarquía administrativa y registrar los cambios de roles. | Comentarios en código |
| `apps/api/src/modules/roles/roles.service.ts` | Implementa las reglas para aplicar la jerarquía administrativa y registrar los cambios de roles. | Comentarios en código |
| `apps/api/src/modules/users/dto/create-user-admin.dto.ts` | Valida los datos del alta de una cuenta solicitada desde administración. | Comentarios en código |
| `apps/api/src/modules/users/dto/query-users.dto.ts` | Define los filtros de búsqueda y el tamaño de página del listado de usuarios. | Comentarios en código |
| `apps/api/src/modules/users/dto/update-own-profile.dto.ts` | Limita la edición del perfil propio a los datos admitidos por la API. | Comentarios en código |
| `apps/api/src/modules/users/dto/update-user-status.dto.ts` | Valida el estado solicitado para la cuenta gestionada desde administración. | Comentarios en código |
| `apps/api/src/modules/users/users.controller.ts` | Expone por HTTP listado, alta administrativa, cambios de estado y edición del perfil propio. | Comentarios en código |
| `apps/api/src/modules/users/users.module.ts` | Registra el controlador y los proveedores de gestión de usuarios y perfiles en NestJS. | Comentarios en código |
| `apps/api/src/modules/users/users.service.spec.ts` | Aísla las dependencias del servicio para comprobar cómo debe coordinar los cambios de cuenta, perfil y vínculo con Moodle. | Comentarios en código |
| `apps/api/src/modules/users/users.service.ts` | Implementa las reglas para coordinar los cambios de cuenta, perfil y vínculo con Moodle. | Comentarios en código |
| `apps/api/test/app.e2e-spec.ts` | Comprueba por HTTP la raíz de la API y la protección de rutas autenticadas. | Comentarios en código |
| `apps/api/test/auth-me.e2e-spec.ts` | Comprueba que el perfil HTTP se derive de una identidad autenticada con MFA. | Comentarios en código |
| `apps/api/test/auth.e2e-spec.ts` | Comprueba los contratos HTTP de registro, sesión, TOTP y recuperación. | Comentarios en código |
| `apps/api/test/lifecycle.e2e-spec.ts` | Ejercita el recorrido HTTP de identidad, admisión y acceso académico con integraciones simuladas. | Comentarios en código |
| `apps/api/tsconfig.build.json` | Alcance de la compilación de producción de la API. | Guía externa |
| `apps/api/tsconfig.json` | Configuración general del compilador de la API. | Guía externa |
| `apps/api/vitest.config.e2e.ts` | Configura Vitest para ejecutar las suites que levantan la aplicación HTTP. | Comentarios en código |
| `apps/api/vitest.config.ts` | Define la configuración de Vitest para las pruebas unitarias de la API. | Comentarios en código |
| `apps/web/.dockerignore` | Controla la construcción y el contexto de la imagen del servicio. | Comentarios en código |
| `apps/web/.env.example` | Plantilla de configuración pública para el navegador. | Guía externa |
| `apps/web/.gitignore` | Configura el seguimiento y el tratamiento local de archivos en Git. | Comentarios en código |
| `apps/web/AGENTS.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `apps/web/Dockerfile` | Compila Next.js con las variables públicas del portal y prepara su imagen de ejecución. | Comentarios en código |
| `apps/web/README.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `apps/web/eslint.config.mjs` | Configura las reglas de Next.js y TypeScript para el análisis del frontend. | Comentarios en código |
| `apps/web/next.config.ts` | Configura la compilación de Next.js y las reglas de Turbopack para los estilos. | Comentarios en código |
| `apps/web/package-lock.json` | Lockfile generado por npm. | Excluido |
| `apps/web/package.json` | Comandos y dependencias del portal. | Guía externa |
| `apps/web/public/INICIA22-1024x100.png` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/Logo-con-Blanco-1.png` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/course-covers/books.webp` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/course-covers/laptop.webp` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/course-covers/notebook.webp` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/course-covers/tablet.webp` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/file.svg` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/globe.svg` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/iinicia-landing-hero.webp` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/inicia-nav-wordmark.png` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/next.svg` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/universidad-inicia-wordmark.png` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/vercel.svg` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/public/window.svg` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/scripts/dev-demo.cjs` | Arranca la demo local o compartida con su configuración de red y un directorio de compilación propio. | Comentarios en código |
| `apps/web/src/app/admisiones/page.tsx` | Conserva la URL de admisiones y dirige al visitante a esa sección de la portada. | Comentarios en código |
| `apps/web/src/app/certificaciones/page.tsx` | Dirige al visitante a las certificaciones publicadas en la portada. | Comentarios en código |
| `apps/web/src/app/confirmar-correo/page.tsx` | Interpreta el resultado del enlace de verificación de correo y orienta al usuario hacia el inicio de sesión. | Comentarios en código |
| `apps/web/src/app/contacto/page.tsx` | Conserva el acceso directo a la sección pública de contacto. | Comentarios en código |
| `apps/web/src/app/cursos/page.tsx` | Dirige al catálogo de cursos que se muestra en la portada. | Comentarios en código |
| `apps/web/src/app/dashboard/admin/asignaciones/page.tsx` | Reúne las operaciones de asignación académica y revocación de matrículas desde administración. | Comentarios en código |
| `apps/web/src/app/dashboard/admin/page.tsx` | Centraliza los flujos administrativos de usuarios, admisiones, programas, matrículas y auditoría. | Comentarios en código |
| `apps/web/src/app/dashboard/aspirante/page.tsx` | Muestra el avance de las postulaciones y las opciones académicas que puede solicitar el aspirante. | Comentarios en código |
| `apps/web/src/app/dashboard/coordinador/page.tsx` | Carga el espacio de coordinación para la gestión dentro de los programas asignados. | Comentarios en código |
| `apps/web/src/app/dashboard/docente/page.tsx` | Muestra las asignaciones docentes y abre el curso o el calificador en Moodle. | Comentarios en código |
| `apps/web/src/app/dashboard/estudiante/page.tsx` | Muestra cursos autorizados, avance y perfil del estudiante, y permite iniciar el acceso al campus. | Comentarios en código |
| `apps/web/src/app/dashboard/page.tsx` | Presenta los accesos disponibles para la sesión y redirige cuando corresponde a un panel específico. | Comentarios en código |
| `apps/web/src/app/dashboard/soporte/page.tsx` | Carga el espacio de trabajo de soporte con las opciones permitidas para ese rol. | Comentarios en código |
| `apps/web/src/app/diplomados/page.tsx` | Conserva el acceso desde enlaces anteriores y dirige a la oferta principal. | Comentarios en código |
| `apps/web/src/app/favicon.ico` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/src/app/globals.css` | Define las variables de color y las utilidades de movimiento y presentación compartidas por el portal. | Comentarios en código |
| `apps/web/src/app/icon.svg` | Recurso gráfico distribuido con la interfaz. | Excluido |
| `apps/web/src/app/landing.module.css` | La página de inicio comparte tiempos de transición entre la portada, el catálogo y las secciones. Las reglas de movimiento reducido adaptan los efectos a la preferencia del navegador. | Comentarios en código |
| `apps/web/src/app/layout.tsx` | Define el documento común y monta los proveedores, la cabecera y el pie del portal. | Comentarios en código |
| `apps/web/src/app/login/page.tsx` | Presenta las credenciales, el desafío CAPTCHA y el paso TOTP que completa la sesión. | Comentarios en código |
| `apps/web/src/app/page.tsx` | Reúne el portal público, carga la oferta desde la API y conecta el catálogo con admisiones y contacto. | Comentarios en código |
| `apps/web/src/app/programas/[slug]/page.tsx` | Resuelve el identificador de la URL y delega la consulta del programa al componente de detalle. | Comentarios en código |
| `apps/web/src/app/recuperar-password/page.tsx` | Solicita un enlace de recuperación vinculado al navegador mediante PKCE. | Comentarios en código |
| `apps/web/src/app/registro/page.tsx` | Recoge los datos del aspirante y muestra el resultado del registro y la confirmación por correo. | Comentarios en código |
| `apps/web/src/app/restablecer-password/page.tsx` | Completa la recuperación a partir del enlace por correo y solicita TOTP cuando la API lo exige. | Comentarios en código |
| `apps/web/src/app/universidad/page.tsx` | Dirige a la sección institucional de la portada. | Comentarios en código |
| `apps/web/src/components/AuthCaptcha.tsx` | Monta Turnstile en el navegador y entrega al formulario un token vigente para cada intento. | Comentarios en código |
| `apps/web/src/components/BrandWordmark.tsx` | Dibuja la marca textual que se reutiliza en la navegación del portal. | Comentarios en código |
| `apps/web/src/components/ComingSoon.tsx` | Presenta un estado temporal para secciones que todavía no ofrecen una acción. | Comentarios en código |
| `apps/web/src/components/CoordinatorRequests.tsx` | El panel muestra las solicitudes que la API autorizó para el ámbito de la coordinación. | Comentarios en código |
| `apps/web/src/components/PortalHelpChat.tsx` | El diálogo conserva los turnos en memoria para dar contexto a la siguiente pregunta. | Comentarios en código |
| `apps/web/src/components/RoleWorkspace.tsx` | Comparte el espacio de coordinación y soporte, con datos y opciones ajustados al rol. | Comentarios en código |
| `apps/web/src/components/ScrollRevealText.tsx` | Aplica una transición de lectura al entrar en la zona visible de la página. | Comentarios en código |
| `apps/web/src/components/SiteFooter.tsx` | Agrupa la navegación secundaria del portal y los enlaces institucionales. | Comentarios en código |
| `apps/web/src/components/SiteHeader.tsx` | Coordina la navegación pública, la búsqueda, el tema y los accesos de sesión. | Comentarios en código |
| `apps/web/src/components/campus-tech/CampusSearch.tsx` | Filtra las acciones del panel suministradas por la vista y permite saltar a la pestaña elegida. | Comentarios en código |
| `apps/web/src/components/campus-tech/CampusShell.tsx` | Organiza los paneles del campus alrededor de una barra superior y un menú adaptable. | Comentarios en código |
| `apps/web/src/components/campus-tech/CampusSidebar.tsx` | Renderiza secciones y opciones del menú lateral según la configuración del panel. | Comentarios en código |
| `apps/web/src/components/campus-tech/CampusTopBar.tsx` | Muestra el encabezado de la sesión, los controles de tema y el acceso a la búsqueda. | Comentarios en código |
| `apps/web/src/components/campus-tech/Icons.tsx` | Define los SVG reutilizados por la navegación y los estados de los paneles. | Comentarios en código |
| `apps/web/src/components/moodle/LaunchCourseButton.tsx` | Solicita el enlace de sesión del curso y lo abre en una ventana del campus. | Comentarios en código |
| `apps/web/src/components/moodle/MoodleSyncBadge.tsx` | Traduce el estado de sincronización de Moodle a una etiqueta visible. | Comentarios en código |
| `apps/web/src/components/programs/ProgramDetail.tsx` | Carga el programa identificado por su slug y distingue carga, error y programa inexistente. | Comentarios en código |
| `apps/web/src/contexts/AuthContext.tsx` | Mantiene el perfil autenticado y las acciones de sesión que comparten las pantallas. | Comentarios en código |
| `apps/web/src/contexts/ThemeContext.tsx` | Aplica el tema elegido al documento y conserva la preferencia en el navegador. | Comentarios en código |
| `apps/web/src/lib/api.ts` | Centraliza el transporte HTTP y separa las operaciones del portal en clientes por recurso. | Comentarios en código |
| `apps/web/src/lib/moodle-window.ts` | Administra la apertura, navegación y cierre de la ventana usada para los saltos SSO a Moodle. | Comentarios en código |
| `apps/web/src/lib/portal-help.ts` | La ayuda es pública. El navegador envía solo la pregunta y hasta tres preguntas anteriores sin adjuntar credenciales de sesión. | Comentarios en código |
| `apps/web/src/lib/recovery-pkce.ts` | Genera la prueba PKCE y conserva temporalmente el verificador necesario para canjear el enlace de recuperación. | Comentarios en código |
| `apps/web/src/types/index.ts` | Representa los contratos de identidad, catálogo, admisión y Moodle que consume la web. | Comentarios en código |
| `apps/web/test/moodle-window.test.mjs` | Comprueba la función que usa el navegador antes de abrir el campus con enlaces locales de prueba, sin depender del Moodle de producción. | Comentarios en código |
| `apps/web/tsconfig.json` | Tipos y resolución de rutas en el portal. | Guía externa |
| `database/001_initial_user_tables.sql` | Define, migra o verifica los datos y permisos de PostgreSQL según su ubicación. | Comentarios en código |
| `docker/.env.example` | Plantilla de variables utilizadas por los servicios locales. | Guía externa |
| `docker/compose.yaml` | BASE DE DATOS POSTGRESQL (Supabase / IINICIA) | Comentarios en código |
| `docker/init-db/00-roles.sql` | Inicialización de roles estándar de Supabase para PostgreSQL local | Comentarios en código |
| `docker/init-db/01-auth-schema.sql` | Volcado del esquema de autenticación para inicializar el entorno local. | Excluido |
| `docker/init-db/02-baseline.sql` | Copia de la migración base utilizada por Docker. | Excluido |
| `docker/init-db/03-seed.sql` | SEMILLAS REPRODUCIBLES DE LINEA BASE (ROLES, PERMISOS, CATALOGOS) | Comentarios en código |
| `docs/README.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/actualizaciones-api-y-web.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/autenticacion-dos-factores.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/backend-architecture.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/bitacora-proyecto.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/captcha-auth.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/cursos/html-basico/GUIA-MOODLE.txt` | Material didáctico para Moodle. Incluye el HTML compactado de distribución. | Excluido |
| `docs/cursos/html-basico/index.html` | Material didáctico para Moodle. Incluye el HTML compactado de distribución. | Excluido |
| `docs/decisiones/ADR-001-acceso-supabase.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/demostracion-moodle.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/despliegue-recuperacion.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/especificacion-vistas-frontend-roles.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/estado-actual.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/flujo-admisiones.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/frontend-integration-guide.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/frontend.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/literaria/api.md` | Capítulo derivado de los archivos fuente. | Excluido |
| `docs/literaria/infraestructura.md` | Capítulo derivado de los archivos fuente. | Excluido |
| `docs/literaria/web.md` | Capítulo derivado de los archivos fuente. | Excluido |
| `docs/manual-estudiante.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/manual-portales-y-paginas.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/manual-profesor.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/manual-superadministrador.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/migracion-wordpress.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/modelo-relacional.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/moodle-theme.scss` | Propuesta visual IINICIA para el tema Boost de Moodle. | Comentarios en código |
| `docs/openapi.json` | Contrato HTTP en el formato que consume la interfaz interactiva. | Guía externa |
| `docs/openapi.yaml` | Contrato HTTP de la API. Las rutas documentan el método, los datos de entrada y las respuestas que consumen el portal y las pruebas. | Comentarios en código |
| `docs/politicas-rls.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/programacion-literaria.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/pruebas-coordinacion-supabase.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/reporte-entrega-final.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/revision-seguridad-20261120.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/revision-seguridad-20261123.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/seguridad-auditoria.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/supabase-access-policy.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/supabase-auditoria-esquema.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/supabase-configuracion-manual.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/traspaso-antigravity.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `docs/validacion-identidad-supabase.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `progreso.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `scripts/literate.mjs` | Cada bloque del capítulo corresponde a un archivo. La extracción aplica las mismas reglas de rutas que la generación y escribe en un directorio nuevo. | Comentarios en código |
| `supabase/history/20261020110000_initial_schema.sql` | Revisar antes de aplicar manualmente desde el SQL Editor de Supabase. | Comentarios en código |
| `supabase/history/20261110120000_require_mfa_data_api.sql` | No reemplazar controles de otro proyecto o ambiente. | Comentarios en código |
| `supabase/history/20261113120000_admission_review.sql` | Requires the current portal schema, including admission_applications and roles.slug. | Comentarios en código |
| `supabase/history/20261114120000_course_offerings.sql` | La oferta describe cursos activos; el acceso académico sigue requiriendo | Comentarios en código |
| `supabase/history/README.md` | Documento preexistente, separado del código que se anota. | Excluido |
| `supabase/migrations/20261115000000_baseline_schema.sql` | LINEA BASE UNIFICADA DE SUPABASE / POSTGRESQL | Comentarios en código |
| `supabase/migrations/20261116120000_staff_scope.sql` | Las mutaciones administrativas pasan por NestJS para comprobar jerarquía y ámbito. | Comentarios en código |
| `supabase/migrations/20261120120000_limit_client_privileges.sql` | Estos privilegios operan fuera de RLS y no los necesita ningún cliente del portal. | Comentarios en código |
| `supabase/repairs/20261114_remote_admissions.sql` | Reparación del Supabase de desarrollo: mmtuaangwbsdtddeplfv. | Comentarios en código |
| `supabase/seed.sql` | SEMILLAS REPRODUCIBLES DE LINEA BASE (ROLES, PERMISOS, CATALOGOS) | Comentarios en código |
| `supabase/tests/client_privileges.sql` | Comprueba primero los permisos de tabla y después el efecto de las políticas sobre sesiones de prueba. | Comentarios en código |
| `supabase/tests/staff_scope.sql` | Define, migra o verifica los datos y permisos de PostgreSQL según su ubicación. | Comentarios en código |
