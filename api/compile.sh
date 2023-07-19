#!/bin/bash

rm -rf dist/ 
tsc --project .

cp -r ./src/afip/Claves ./dist/src/afip/Claves
cp -r ./src/afip/ClavesLibrosSilvestres ./dist/src/afip/ClavesLibrosSilvestres
cp -r ./src/afip/afip.js/src/Afip_res ./dist/src/afip/afip.js/src/Afip_res

cp -r ./src/comprobantes/factura ./dist/src/comprobantes/factura
cp -r ./src/comprobantes/remito ./dist/src/comprobantes/remito