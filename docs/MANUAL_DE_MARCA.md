# Manual de marca — SiSOC Mobil PWA

Versión 1.0 · 16 de julio de 2026

## 1. Propósito

Este manual define la identidad visual y verbal de SiSOC Mobil, la aplicación
web progresiva de SISOC. Es la referencia para diseñar pantallas, desarrollar
componentes, producir piezas de comunicación y revisar consistencia visual.

La marca debe transmitir:

- **institucionalidad:** es una herramienta oficial de gestión pública;
- **claridad:** acompaña tareas operativas que deben resolverse sin ambigüedad;
- **cercanía:** utiliza lenguaje directo, respetuoso y comprensible;
- **confiabilidad:** informa estados, errores y sincronización de forma visible;
- **accesibilidad:** funciona en dispositivos móviles y contextos de conectividad
  limitada.

## 2. Nombre de la marca

### Denominación principal

**SiSOC Mobil**

### Denominación técnica

Puede utilizarse **PWA de SISOC** en documentación técnica, tickets y material
interno.

### Usos incorrectos

- No escribir `SISOC Mobile`, `Sisoc`, `SiSoc` ni `SISOC Móvil` en piezas de
  comunicación.
- No traducir el nombre.
- No agregar nombres de programas al logotipo.

> Nota de implementación: el proyecto conserva actualmente el identificador
> técnico `sisoc-mobil`. Este nombre de paquete no define la escritura pública de
> la marca.

## 3. Logotipo e isotipo

### Activos oficiales de la PWA

| Uso | Archivo |
| --- | --- |
| Logotipo sobre fondo oscuro | `src/assets/images/sisoc_dark_mode.png` |
| Logotipo sobre fondo claro | `src/assets/images/sisoc_light_mode.png` |
| Ícono de aplicación, 192 px | `public/sisoc_ico_192.png` |
| Ícono de aplicación, 512 px | `public/sisoc_ico_512.png` |
| Ícono auxiliar | `public/icono.png` |

### Selección de variante

- Usar `sisoc_dark_mode.png` sobre azul institucional o superficies oscuras.
- Usar `sisoc_light_mode.png` sobre blanco o superficies claras.
- Los íconos cuadrados se reservan para instalación, favicon, notificaciones y
  accesos directos del sistema operativo.

### Área de protección

Mantener alrededor del logotipo un espacio libre mínimo equivalente a la altura
de la letra `S` del propio logotipo. Ningún texto, borde, ícono o control debe
invadir esa área.

### Tamaño mínimo

- Logotipo completo en pantalla: **120 px de ancho**.
- Isotipo/ícono de interfaz: **24 px**.
- Ícono de instalación: utilizar únicamente los tamaños provistos.

### Usos prohibidos

- No deformar, rotar, inclinar ni recortar el logotipo.
- No cambiar sus colores ni aplicar degradados, sombras o contornos.
- No colocarlo sobre fotografías o fondos que reduzcan su contraste.
- No reconstruirlo con texto ni usar un archivo de baja resolución.

## 4. Paleta cromática

### Colores principales

| Token recomendado | Color | Uso |
| --- | --- | --- |
| `brand-navy` | `#232D4F` | Cabeceras, navegación, botones primarios y texto institucional |
| `brand-steel` | `#3E5A7E` | Fondo principal del modo oscuro y pantallas de acceso |
| `brand-gold` | `#E7BA61` | Acentos, selección activa, divisores y estados destacados |
| `brand-white` | `#FFFFFF` | Texto sobre fondos oscuros y superficies claras |

### Colores complementarios

| Token recomendado | Color | Uso |
| --- | --- | --- |
| `brand-teal` | `#3B8681` | Acento complementario y módulos asociados |
| `surface-light` | `#F5F5F5` | Fondo secundario en modo claro |
| `surface-dark` | `#16213C` | Tarjetas en modo oscuro |
| `surface-dark-raised` | `#1E2A47` | Controles elevados en modo oscuro |
| `text-primary` | `#111827` | Texto principal sobre fondo claro |
| `text-muted` | `#6F7180` | Texto secundario sobre fondo claro |
| `border-light` | `#E0E0E0` | Bordes y separadores claros |

### Colores semánticos

| Estado | Principal | Fondo claro sugerido | Uso |
| --- | --- | --- | --- |
| Éxito | `#2E7D33` | `#EDF7EE` | Operación confirmada, estado correcto |
| Error/peligro | `#C62828` | `#FFF5F5` | Error, eliminación o acción destructiva |
| Advertencia | `#8C6A1D` | `#FFF4D6` | Atención requerida, sincronización pendiente |
| Neutro | `#6C757D` | `#F8F9FA` | Acciones secundarias y estados informativos |

### Reglas de aplicación

- El azul `brand-navy` es el color dominante de marca.
- El dorado es un acento: no debe ocupar grandes superficies ni reemplazar el
  color primario.
- Sobre blanco, el dorado no debe usarse para texto pequeño porque no ofrece
  contraste suficiente. Utilizar `brand-navy` o `#8C6A1D`.
- Sobre `brand-navy`, el dorado puede emplearse en íconos, indicadores activos y
  textos breves en negrita.
- Los estados no deben comunicarse únicamente mediante color: acompañarlos con
  texto, ícono o ambos.
- No introducir nuevos colores sin incorporarlos primero a esta paleta.

## 5. Tipografía

La familia tipográfica de la PWA es **Montserrat**, cargada desde Google Fonts.
Las fuentes de respaldo son `sans-serif`.

### Pesos habilitados

- `400` — texto corriente;
- `500` — etiquetas y datos destacados;
- `600` — botones, campos y subtítulos;
- `700` — títulos y encabezados;
- `800` — énfasis excepcional, cifras o indicadores.

### Escala recomendada

| Nivel | Tamaño | Peso | Uso |
| --- | --- | --- | --- |
| Título de pantalla | 20–24 px | 700 | Encabezado principal |
| Título de sección | 16–18 px | 700 | Agrupación de contenido |
| Título de tarjeta | 14–16 px | 600 | Nombre de entidad o acción |
| Cuerpo | 14 px | 400 | Texto general |
| Etiqueta/control | 12–14 px | 600 | Campos, botones y estados |
| Ayuda/metadato | 11–12 px | 400–500 | Fecha, contexto y aclaraciones |

### Reglas tipográficas

- Usar mayúsculas sostenidas solo en etiquetas breves o categorías.
- En mayúsculas, aplicar un espaciado entre letras moderado (`0.06em` a
  `0.08em`).
- No justificar texto en pantallas móviles.
- Evitar párrafos largos; priorizar frases y bloques escaneables.
- Respetar las tildes, la `ñ` y la puntuación del español.

## 6. Iconografía

La interfaz usa **Font Awesome** como sistema principal de íconos.

### Criterios

- Usar íconos sólidos, simples y reconocibles.
- Tamaño habitual: **16–20 px**; acciones principales: hasta **24 px**.
- Mantener el mismo ícono para una misma acción en toda la aplicación.
- Todo ícono sin texto visible debe incluir `aria-label`.
- Los íconos decorativos deben utilizar `aria-hidden="true"`.
- No mezclar estilos de íconos dentro de un mismo componente.

## 7. Formas, bordes y elevación

La identidad utiliza formas redondeadas y superficies claras, evitando una
estética excesivamente rígida.

### Radios

| Elemento | Radio recomendado |
| --- | --- |
| Botón compacto o chip | 9999 px (`rounded-full`) |
| Botón y campo estándar | 10–12 px |
| Tarjeta | 15–18 px |
| Modal | 28 px |
| Cabecera principal inferior | 50 px |

### Bordes

- Borde estándar: 1 px.
- Acento de marca: 2 px en dorado, reservado para cabeceras o selección.
- En modo oscuro: blanco con 15–20 % de opacidad.
- En modo claro: `border-light` o gris equivalente.

### Sombras

- Usar sombras suaves para indicar elevación, no como decoración.
- Botones: sombra corta, equivalente a `0 1px 2px rgba(0,0,0,.12)`.
- Modales: sombra amplia y difusa.
- No combinar sombra intensa con borde intenso en una misma tarjeta.

## 8. Componentes de interfaz

### Botones

- Altura táctil mínima: **44 px** para acciones principales.
- Texto en peso `600` y verbo claro: `Guardar`, `Continuar`, `Eliminar`.
- Acción primaria: fondo `brand-navy`, texto blanco.
- Acción secundaria: gris neutro o variante con contorno.
- Éxito: verde; peligro: rojo.
- Una pantalla debe tener una única acción primaria dominante.
- El estado deshabilitado mantiene legibilidad y utiliza opacidad, sin ocultar el
  control.

### Campos

- Etiqueta siempre visible encima del campo; el placeholder no reemplaza la
  etiqueta.
- Altura mínima de 40–44 px.
- Fondo blanco en modo claro y `surface-dark-raised` en modo oscuro.
- Los errores se muestran debajo del campo con texto específico e indicación
  visual adicional al color.

### Tarjetas

- Radio de 15–18 px, borde sutil y espaciado interno mínimo de 16 px.
- Título, estado y acción deben conservar una jerarquía clara.
- Evitar degradados en tarjetas operativas; utilizar superficies planas.

### Modales

- Radio de 28 px y ancho adaptado a móvil.
- Título descriptivo, mensaje breve y acciones inequívocas.
- La acción destructiva debe estar identificada en rojo.
- Permitir cierre mediante botón visible y navegación accesible por teclado.

### Navegación

- Cabecera: fondo `brand-navy` con borde/acento dorado.
- Barra inferior: máximo cinco destinos prioritarios.
- La opción activa se identifica con dorado, texto y/o cambio de ícono.
- Conservar el destino `Volver` cuando el usuario entra a un flujo jerárquico.

### Mensajes de estado

- Éxito: confirmar qué se guardó o envió.
- Error: explicar el problema y, cuando sea posible, cómo resolverlo.
- Advertencia: informar el riesgo sin tono alarmista.
- Sin datos: describir por qué no hay contenido y ofrecer una acción si aplica.
- Offline/sincronización: indicar claramente si la información está guardada en
  el dispositivo, pendiente o sincronizada.

## 9. Modo claro y modo oscuro

La PWA soporta ambos temas y respeta inicialmente la preferencia del sistema.

### Modo claro

- Fondo principal blanco.
- Tarjetas blancas o `surface-light`.
- Texto principal `brand-navy` o `text-primary`.
- Bordes grises claros.

### Modo oscuro

- Fondo principal `brand-steel`.
- Cabeceras `brand-navy`.
- Tarjetas `surface-dark` y controles `surface-dark-raised`.
- Texto blanco; texto secundario con 70–80 % de opacidad.
- Dorado como acento y selección.

### Regla de equivalencia

Todo componente nuevo debe diseñarse y probarse en ambos modos. No se aprueba un
componente que dependa de un color fijo ilegible en uno de los temas.

## 10. Espaciado y composición

Usar una grilla base de **4 px**.

- Separación mínima entre elementos relacionados: 8 px.
- Espaciado habitual dentro de componentes: 12–16 px.
- Separación entre secciones: 16–24 px.
- Margen lateral móvil recomendado: 16–24 px.
- Ancho de lectura: evitar líneas de texto excesivamente largas en tablet o
  escritorio.

La información más importante debe aparecer primero. Las pantallas operativas
deben privilegiar lectura vertical, acciones visibles y desplazamiento mínimo.

## 11. Movimiento

- Transiciones de interacción: 150–260 ms.
- Entrada progresiva de tarjetas: hasta 340 ms.
- El movimiento debe explicar continuidad o estado, nunca distraer.
- Respetar `prefers-reduced-motion`: desactivar animaciones no esenciales.
- Evitar animaciones infinitas, excepto indicadores de carga claramente
  necesarios.

## 12. Accesibilidad

Todo desarrollo debe cumplir como mínimo WCAG 2.1 nivel AA.

- Contraste mínimo: 4.5:1 para texto normal y 3:1 para texto grande.
- Área táctil mínima: 44 × 44 px.
- Foco de teclado visible.
- Orden de navegación lógico.
- Etiquetas asociadas a todos los campos.
- Texto alternativo en imágenes informativas.
- Estados anunciables para lectores de pantalla.
- No depender únicamente de color, posición o movimiento.
- Mensajes comprensibles, sin códigos técnicos para el usuario final.

## 13. Voz y tono

### Voz

Institucional, directa, respetuosa y orientada a la acción.

### Criterios de redacción

- Hablar de `vos`, de manera consistente con la interfaz actual.
- Utilizar verbos concretos y frases breves.
- Nombrar los objetos tal como los conoce la persona usuaria.
- Evitar tecnicismos, siglas no explicadas y mensajes genéricos.
- No culpabilizar al usuario ante un error.

### Ejemplos

| Evitar | Usar |
| --- | --- |
| `Operación exitosa` | `La conformidad quedó registrada.` |
| `Error 400` | `Revisá el período seleccionado.` |
| `Submit` | `Enviar` |
| `No hay data` | `Todavía no hay registros para este período.` |
| `¿Está seguro?` | `¿Querés eliminar este documento?` |

## 14. Convenciones para desarrollo

Los valores de este manual son la referencia semántica. Al centralizar el diseño,
usar nombres por función y no por apariencia:

```ts
export const brand = {
  navy: '#232D4F',
  steel: '#3E5A7E',
  gold: '#E7BA61',
  teal: '#3B8681',
  success: '#2E7D33',
  danger: '#C62828',
  warning: '#8C6A1D',
} as const
```

- Reutilizar `appButtonClass` y componentes de `src/ui/`.
- No duplicar variantes ya existentes.
- No introducir colores hexadecimales nuevos en una pantalla aislada.
- Verificar modo claro, modo oscuro, ancho móvil y navegación por teclado.
- Mantener los activos de marca en formatos y ubicaciones estables.

## 15. Lista de control

Antes de aprobar una pantalla o pieza:

- [ ] Usa el nombre **SiSOC Mobil** correctamente.
- [ ] Usa el logotipo adecuado para el fondo.
- [ ] Respeta la paleta y la tipografía.
- [ ] Tiene una jerarquía visual clara.
- [ ] Funciona en modo claro y oscuro.
- [ ] Los controles táctiles tienen al menos 44 × 44 px.
- [ ] Los estados no dependen solo del color.
- [ ] Los textos son breves, específicos y están en español correcto.
- [ ] Tiene foco visible, etiquetas y atributos accesibles.
- [ ] Fue revisada en un dispositivo móvil o viewport equivalente.

## 16. Fuente de verdad y mantenimiento

Este documento es la fuente de verdad de identidad para la PWA. Los activos
enumerados y los componentes compartidos de `src/ui/` son su implementación.

Todo cambio de logotipo, color principal, tipografía o tono debe:

1. actualizar este manual;
2. actualizar los tokens o componentes compartidos;
3. verificar ambos temas y accesibilidad;
4. registrar la decisión en el historial del repositorio.
