---
name: creador-de-habilidades
description: Esta habilidad permite al asistente crear nuevas habilidades dentro del workspace, asegurando que sigan la estructura correcta y que todas las instrucciones y metadatos estén en idioma español.
---

# Creador de Habilidades

Esta habilidad se activa cuando el usuario desea crear una nueva capacidad o "skill" para el asistente en este workspace. Su objetivo es estandarizar la creación de habilidades y asegurar que el contenido sea accesible y claro para hablantes de español.

## Estructura de una Habilidad

Cada habilidad debe residir en su propia carpeta dentro de `.agent/skills/` y contener al menos un archivo `SKILL.md`.

Estructura de archivos:
- `.agent/skills/[nombre-de-la-habilidad]/SKILL.md` (Obligatorio)
- `.agent/skills/[nombre-de-la-habilidad]/scripts/` (Opcional, para scripts de apoyo)
- `.agent/skills/[nombre-de-la-habilidad]/examples/` (Opcional, para ejemplos de uso)

## Reglas de Oro para Nuevas Habilidades

1. **Idioma**: Todo el contenido de `SKILL.md`, incluyendo la descripción en el frontmatter, debe estar en **español**.
2. **YAML Frontmatter**: Debe incluir `name` (en minúsculas con guiones) y `description` (una explicación concisa de qué hace la habilidad y cuándo usarla).
3. **Claridad**: Las instrucciones dentro de `SKILL.md` deben ser precisas y fáciles de seguir para el asistente.
4. **Modularidad**: Diseña habilidades que resuelvan problemas específicos.

## Instrucciones para el Asistente

Cuando se te pida crear una nueva habilidad:
1. Define un nombre descriptivo en español para la carpeta (ej. `gestor-de-base-de-datos`).
2. Crea el archivo `SKILL.md` con el frontmatter YAML necesario.
3. Define las secciones principales: Propósito, Cuándo usarla, e Instrucciones Detalladas.
4. Si la habilidad requiere herramientas externas o scripts, crea la carpeta `scripts/` y coloca los archivos allí.
