# Frontera con el boletín de listmonk (`proy_mailing`) — quién le escribe a quién sobre `ecuadornotlc.org`

> Documento de referencia cruzada. `ecuadornotlc.org` tiene, además de esta plataforma de peticiones,
> un segundo sistema de correo — un boletín informativo semanal servido por una instancia de listmonk
> en `boletin.ecuadornotlc.org`, que vive en un repositorio hermano (`proy_mailing`), en el mismo VPS,
> pero con infraestructura, base de datos y consentimiento **completamente aislados** de este proyecto.
> Este documento existe porque, hasta la sesión que lo agregó, esa relación solo estaba documentada del
> otro lado — nadie que trabajara únicamente en este repo tenía forma de enterarse.

## Por qué importa

Dos sistemas de correo distintos, bajo el mismo dominio raíz, compartiendo además la misma cuenta de
Resend (ver `Configuración → Plataforma` de este panel: el "Correo remitente" de la plataforma es
`noreply@cauce.ecuadornotlc.org`, distinto del remitente del boletín). Si alguien que trabaja en este
repo propone, sin conocer esta frontera, importar la base de firmantes a listmonk, sincronizar
consentimientos, o cualquier atajo "para no duplicar trabajo", rompe una decisión de diseño explícita
tomada del otro lado — y probablemente crea un incumplimiento LOPDP (tratar datos para una finalidad
distinta de la consentida).

## Los dos tratamientos

| | Esta plataforma (`petition-cauce`) | El boletín (`proy_mailing` / listmonk) |
|---|---|---|
| A quién le escribe | Firmantes de sus campañas, y solo sobre esas campañas | Suscriptores de su propia lista, no derivados de una firma |
| Base legal | Consentimiento de la firma + consentimiento de avisos (`consents.notify_updates`) | Alta con doble confirmación (doble opt-in) en la propia lista |
| ¿Firmar suscribe al boletín? | — | **No** |
| ¿Suscribirse al boletín implica algo sobre la petición firmada? | **No** | — |
| ¿Una baja en una se propaga a la otra? | **No** | **No** |
| ¿Un rebote/queja en una se propaga a la otra? | **No** (`supresion-global` de `proy_mailing`, Fase 3, resuelve esto *entre organizaciones de listmonk*, no entre estas dos plataformas) | **No** |

Cada plataforma es dueña completa de su propio ciclo de vida de consentimiento. Retirar el
consentimiento de una no implica retirar el de la otra — son dos tratamientos con finalidades y bases
legales distintas bajo la LOPDP, aunque temáticamente relacionados.

## La única conexión permitida — de un solo sentido

Quien firmó una campaña y tiene `notify_updates = True` puede recibir, **desde el centro de
comunicaciones de esta plataforma**, una campaña puntual invitándolo a sumarse al boletín. Esa
invitación lleva a un **alta nueva y propia** en listmonk, con su propia doble confirmación — nunca a
una importación ni sincronización de listas. No requiere ningún endpoint ni webhook nuevo en este
repositorio: es un envío de campaña más, con el enlace público de alta del boletín como destino.

Esto se conoce como **F4** del lado de `proy_mailing`. Estado actual (2026-09-06): el enlace técnico ya
existe y está desplegado — un formulario embebido dedicado a esta invitación, en la instancia de
listmonk, que suscribe a una lista separada ("Boletín — origen Cauce") para poder medir por separado la
calidad de las altas que llegan por esta vía. **Falta la decisión de negocio**: qué segmento exacto
recibe la invitación (¿todos los `notify_updates = True`, o un subconjunto?) y en qué momento se envía.
Esa decisión se coordina entre quien gestiona esta plataforma y quien gestiona `proy_mailing` — no es
una pieza técnica pendiente de este repo.

## Dónde está el detalle completo

- `proy_mailing/PROJECT_REFERENCE.md §2b` — qué existe de este lado visto desde `proy_mailing`, con las
  tensiones identificadas y cómo se resolvieron.
- `proy_mailing/openspec/changes/frontera-petition-cauce/` — la propuesta que fijó estas reglas
  (`proposal.md`, `design.md`, `specs/frontera/spec.md` con los requisitos R1-R5).
- `proy_mailing/openspec/changes/org-piloto/` — dónde se implementó (copy de independencia en el
  formulario de alta, correo de confirmación y página de baja del boletín).

## Qué NO hacer desde este repo, aunque parezca una simplificación razonable

- No importar `consents.notify_updates` (ni ningún otro dato de firmantes) directamente a listmonk.
- No construir ningún puente automatizado que sincronice bajas, rebotes o quejas entre esta plataforma
  y el boletín — es una decisión de diseño explícita, no un pendiente técnico.
- No asumir que el `From` o la cuota de Resend son independientes entre ambos sistemas: comparten la
  misma cuenta (plan free, 100 emails/día / 3.000/mes a la fecha), así que un envío de volumen desde
  cualquiera de los dos lados consume la misma cuota.
