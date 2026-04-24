---
name: generador-de-imagenes-nano-banana
description: Genera y edita imágenes con Nano Banana Pro usando las credenciales OAuth de Google Antigravity de Pi. Úsalo para crear iconos, logos, banners, ilustraciones, mockups y escenas fotorrealistas con alta fidelidad (hasta 4K).
---

# Generador de Imágenes Nano Banana

Esta habilidad permite al asistente generar y editar contenido visual de alta calidad utilizando el motor Nano Banana Pro. Es ideal para tareas de diseño gráfico, marca y creación de activos visuales para los proyectos.

## CUÁNDO USARLA

- Cuando el usuario solicite la creación de un logo, icono o banner.
- Para generar mockups de interfaces de usuario o prototipos visuales.
- Al editar imágenes existentes para cambiar su estilo, fondo o elementos internos.
- Siempre que se requiera una imagen con una resolución específica (1K, 2K, 4K) o relación de aspecto definida.

## INSTRUCCIONES DETALLADAS

### 1. Preparación del Prompt
No utilices solo palabras clave. Crea una descripción narrativa rica que incluya:
- **Sujeto**: Qué es lo que se está representando.
- **Estilo**: Minimalista, fotorrealista, cyberpunk, 3D render, etc.
- **Iluminación**: Luz suave, neón, cinematográfica, hora dorada.
- **Composición**: Primer plano, vista aérea, enfoque macro.

### 2. Uso de Imágenes de Referencia
Si el usuario proporciona imágenes locales, utilízalas como `references` en la herramienta `nano_banana_generate_image` para mantener la consistencia visual o de personajes. Indica explícitamente en el prompt: "Mantener el estilo y los detalles de la imagen de referencia".

### 3. Parámetros Técnicos
Asegúrate de mapear correctamente los siguientes parámetros:
- `aspectRatio`: Define la forma (ej. `16:9` para banners, `9:16` para historias).
- `size`: Controla la calidad (`1K`, `2K`, `4K`).
- `references`: Proporciona las rutas absolutas de las imágenes de referencia.

### 4. Flujo de Trabajo
1. Analiza el pedido del usuario. Si faltan detalles críticos, pregunta antes de generar.
2. Ejecuta la herramienta `nano_banana_generate_image`.
3. Informa al usuario sobre la ubicación del archivo generado y muestra el resultado.
4. Si se solicitan cambios, utiliza la imagen generada como referencia para la siguiente iteración.

## VALORES POR DEFECTO
- Relación de aspecto: `1:1`
- Tamaño: `2K`
- Modelo: `gemini-3-pro-image`
