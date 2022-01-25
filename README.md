[![license](https://img.shields.io/badge/license-AGPL3-green.svg?style=flat)](https://github.com/binovo/tbai-lib/blob/main/LICENSE)

# Librería typescript para crear y firmar fichero TicketBai.

## Instalación

```sh
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash - # version recomendada de node
sudo apt-get install libxml2-utils

npm run bootstrap # instalar dependencias necesarias y parchear
npm run build     # crear librería JS minimizada en `dist/tbai.js` (UMD)
```

## Otros comandos útiles

```sh
npm run build:debug # crear librería JS con datos para depuración en `dist/tbai.js` (UMD)
npm run test # requiere poder ejecutar el comando chromium-browser
```

## Uso

Las funciones disponible de esta librería son las que se encuentran en los ficheros de tipos de `dist/src`. Hay dos ejemplos de uso de la librería desde Javascript en `dist/index.html` y en `dist/invoice_sequence.html`. La primera demuestra como se puede firmar un documento XML arbitrario, la segunda muestra como se puede generar un fichero TBAI sin firmar partiendo de los datos de la factura y como se puede posteriormente firmar.

Para ejemplos de cómo utilizar la librería de Typescript se recomienda consultar los mencionados ficheros de tipos y los tests.
