import { Cierre } from "./secciones/Cierre";
import { Colofon } from "./secciones/Colofon";
import { Encabezado } from "./secciones/Encabezado";
import { Funcionalidades } from "./secciones/Funcionalidades";
import { Planes } from "./secciones/Planes";
import { Preguntas } from "./secciones/Preguntas";
import { Resumen } from "./secciones/Resumen";
import { Tapa } from "./secciones/Tapa";
import { Video } from "./secciones/Video";

export function App() {
    return (
        <>
            <Encabezado />
            <main>
                <Tapa />
                <Resumen />
                <Video />
                <Funcionalidades />
                <Planes />
                <Preguntas />
                <Cierre />
            </main>
            <Colofon />
        </>
    );
}
