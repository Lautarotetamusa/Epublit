import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type { ApiErrorDetalle } from "../../api/client";
import {
    actualizarPaginaContenido,
    consultarSlugDisponible,
    crearPaginaContenido,
    despublicarPaginaContenido,
    eliminarPaginaContenido,
    obtenerPaginaContenido,
    publicarPaginaContenido
} from "../../api/contenido";
import type { MotivoSlug } from "../../api/contenido";
import { useToast } from "../../notifications/ToastProvider";
import { codigoDeError, detallesDeError, erroresPorCampo, mensajeDeError } from "./erroresContenido";
import { aPaginaInput, mapearPagina } from "./mapeoContenido";
import type { Bloque, ImagenContenido, PaginaContenido, TipoBloque } from "./tipos";
import {
    borradorNuevo,
    crearBloque,
    haySubidasPendientes,
    requisitosDePublicacion,
    slugify,
    slugValido
} from "./tipos";

const ESPERA_SLUG_MS = 350;

type EstadoSlug = {
    slug: string;
    disponible: boolean;
    motivo: MotivoSlug;
};

// El editor carga el detalle real y mantiene una única versión de la página en
// memoria (con `dirty` para los cambios sin guardar). Guardar nunca cambia el
// estado; publicar/despublicar son acciones explícitas y el backend revalida
// el checklist en cada una.
export function useEditorPagina(id: string) {
    const esNueva = id === "nueva";
    const numeroId = Number(id);
    const idInvalido = !esNueva && (!Number.isInteger(numeroId) || numeroId <= 0);
    const { showToast } = useToast();

    const [pagina, setPagina] = useState<PaginaContenido | null>(() => (esNueva ? borradorNuevo() : null));
    // En una página nueva el slug acompaña al título hasta que la editora lo
    // escribe a mano; en una existente nunca se pisa solo.
    const [slugTocado, setSlugTocado] = useState(!esNueva);
    const [dirty, setDirty] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [loading, setLoading] = useState(!esNueva && !idInvalido);
    const [noEncontrada, setNoEncontrada] = useState(idInvalido);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [recarga, setRecarga] = useState(0);
    const [estadoSlug, setEstadoSlug] = useState<EstadoSlug | null>(null);
    const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
    const [detallesPublicacion, setDetallesPublicacion] = useState<ApiErrorDetalle[]>([]);

    useEffect(() => {
        if (esNueva || idInvalido) return;

        let cancelado = false;

        obtenerPaginaContenido(numeroId)
            .then((respuesta) => {
                if (cancelado) return;
                setNoEncontrada(false);
                setErrorCarga(null);
                setPagina(mapearPagina(respuesta.pagina));
                setDirty(false);
                setSlugTocado(true);
                setEstadoSlug(null);
                setErroresCampo({});
                setDetallesPublicacion([]);
            })
            .catch((err: unknown) => {
                if (cancelado) return;
                setPagina(null);
                if (err instanceof ApiError && err.status === 404) {
                    setNoEncontrada(true);
                } else {
                    setErrorCarga(mensajeDeError(err));
                }
            })
            .finally(() => {
                if (!cancelado) setLoading(false);
            });

        return () => {
            cancelado = true;
        };
    }, [numeroId, esNueva, idInvalido, recarga]);

    const cambiar = useCallback((fn: (actual: PaginaContenido) => PaginaContenido) => {
        setPagina((actual) => (actual ? fn(actual) : actual));
        setDirty(true);
        setErroresCampo({});
        setDetallesPublicacion([]);
    }, []);

    const cambiarTitulo = useCallback(
        (titulo: string) => {
            cambiar((actual) => ({
                ...actual,
                titulo,
                slug: slugTocado ? actual.slug : slugify(titulo)
            }));
        },
        [cambiar, slugTocado]
    );

    const cambiarSlug = useCallback(
        (slug: string) => {
            setSlugTocado(true);
            cambiar((actual) => ({ ...actual, slug }));
        },
        [cambiar]
    );

    const cambiarDescripcion = useCallback(
        (descripcion: string) => cambiar((actual) => ({ ...actual, descripcion })),
        [cambiar]
    );

    const cambiarVisibleEnMenu = useCallback(
        (visibleEnMenu: boolean) => cambiar((actual) => ({ ...actual, visibleEnMenu })),
        [cambiar]
    );

    const cambiarOrden = useCallback(
        (orden: number) => cambiar((actual) => ({ ...actual, orden })),
        [cambiar]
    );

    const cambiarPortada = useCallback(
        (portada: ImagenContenido | null) => cambiar((actual) => ({ ...actual, portada })),
        [cambiar]
    );

    const agregarBloque = useCallback(
        (tipo: TipoBloque) => {
            const nuevo = crearBloque(tipo);
            cambiar((actual) => ({ ...actual, bloques: [...actual.bloques, nuevo] }));
            return nuevo.id;
        },
        [cambiar]
    );

    const actualizarBloque = useCallback(
        (idBloque: string, patch: Partial<Bloque>) => {
            cambiar((actual) => ({
                ...actual,
                bloques: actual.bloques.map((bloque) =>
                    bloque.id === idBloque ? ({ ...bloque, ...patch } as Bloque) : bloque
                )
            }));
        },
        [cambiar]
    );

    const moverBloque = useCallback(
        (origen: number, destino: number) => {
            cambiar((actual) => {
                if (
                    origen === destino ||
                    origen < 0 ||
                    destino < 0 ||
                    origen >= actual.bloques.length ||
                    destino >= actual.bloques.length
                ) {
                    return actual;
                }
                const bloques = [...actual.bloques];
                const [movido] = bloques.splice(origen, 1);
                bloques.splice(destino, 0, movido);
                return { ...actual, bloques };
            });
        },
        [cambiar]
    );

    const eliminarBloque = useCallback(
        (idBloque: string) =>
            cambiar((actual) => ({ ...actual, bloques: actual.bloques.filter((bloque) => bloque.id !== idBloque) })),
        [cambiar]
    );

    // El slug se valida contra el backend (con debounce) para que el
    // checklist y el campo muestren "en uso" antes de intentar guardar.
    useEffect(() => {
        if (!pagina) return;

        const slug = pagina.slug.trim();
        if (!slugValido(slug) || estadoSlug?.slug === slug) return;

        let cancelado = false;
        const timer = setTimeout(() => {
            consultarSlugDisponible(slug, esNueva ? undefined : Number(pagina.id))
                .then((respuesta) => {
                    if (!cancelado) setEstadoSlug({ slug, ...respuesta });
                })
                .catch(() => {
                    // Si falla la consulta no se bloquea: guardar y publicar
                    // vuelven a validar el slug del lado del servidor.
                    if (!cancelado) setEstadoSlug({ slug, disponible: true, motivo: "libre" });
                });
        }, ESPERA_SLUG_MS);

        return () => {
            cancelado = true;
            clearTimeout(timer);
        };
    }, [pagina, esNueva, estadoSlug?.slug]);

    const slugDisponible = useMemo(() => {
        if (!pagina) return false;
        if (estadoSlug?.slug !== pagina.slug.trim()) return true;
        return estadoSlug.disponible;
    }, [pagina, estadoSlug]);

    // Mientras el slug es válido y todavía no hay respuesta para esa cadena,
    // la consulta está en curso. Se deriva del estado para no encadenar otro
    // setState dentro del efecto.
    const verificandoSlug = Boolean(pagina && slugValido(pagina.slug.trim()) && estadoSlug?.slug !== pagina.slug.trim());

    const errorSlug = useMemo(() => {
        if (!pagina) return undefined;
        if (erroresCampo.slug) return erroresCampo.slug;
        if (pagina.slug.trim() === "") return "El slug es obligatorio.";
        if (!slugValido(pagina.slug)) return "Usá sólo minúsculas, números y guiones simples.";
        if (estadoSlug?.slug === pagina.slug.trim() && estadoSlug.motivo === "en_uso") {
            return "Ya hay otra página con este slug.";
        }
        return undefined;
    }, [pagina, erroresCampo.slug, estadoSlug]);

    const requisitos = useMemo(
        () => (pagina ? requisitosDePublicacion(pagina, slugDisponible) : []),
        [pagina, slugDisponible]
    );

    const subidasPendientes = pagina ? haySubidasPendientes(pagina) : false;
    const puedeGuardar = Boolean(pagina && pagina.titulo.trim() !== "" && !errorSlug && !subidasPendientes);
    const puedePublicar = puedeGuardar && requisitos.every((requisito) => requisito.ok);

    const manejarError = useCallback(
        (err: unknown) => {
            setErroresCampo(erroresPorCampo(err));
            if (codigoDeError(err) === "publicacion_incompleta") {
                setDetallesPublicacion(detallesDeError(err));
            }
            showToast("error", mensajeDeError(err));
        },
        [showToast]
    );

    const persistir = useCallback(
        async (actual: PaginaContenido): Promise<PaginaContenido> => {
            const input = aPaginaInput(actual);
            const respuesta = esNueva
                ? await crearPaginaContenido(input)
                : await actualizarPaginaContenido(Number(actual.id), input);

            const guardada = mapearPagina(respuesta.pagina);
            setPagina(guardada);
            setDirty(false);
            setErroresCampo({});
            setDetallesPublicacion([]);
            return guardada;
        },
        [esNueva]
    );

    const guardar = useCallback(async (): Promise<PaginaContenido | null> => {
        if (!pagina || !puedeGuardar) return null;

        setGuardando(true);
        try {
            return await persistir(pagina);
        } catch (err) {
            manejarError(err);
            return null;
        } finally {
            setGuardando(false);
        }
    }, [pagina, puedeGuardar, persistir, manejarError]);

    const publicar = useCallback(async (): Promise<PaginaContenido | null> => {
        if (!pagina || !puedePublicar) return null;

        setGuardando(true);
        try {
            // Publicar actúa sobre lo guardado: si hay cambios sin guardar (o
            // la página es nueva) primero se persiste el contenido actual.
            const actual = dirty || esNueva ? await persistir(pagina) : pagina;
            const respuesta = await publicarPaginaContenido(Number(actual.id));
            const publicada = mapearPagina(respuesta.pagina);
            setPagina(publicada);
            setDirty(false);
            setErroresCampo({});
            setDetallesPublicacion([]);
            return publicada;
        } catch (err) {
            manejarError(err);
            return null;
        } finally {
            setGuardando(false);
        }
    }, [pagina, puedePublicar, dirty, esNueva, persistir, manejarError]);

    const despublicar = useCallback(async (): Promise<PaginaContenido | null> => {
        if (!pagina) return null;

        // Si hay cambios sin guardar que no se pueden persistir (por ejemplo,
        // se borró el título), no se despublica a ciegas: primero hay que
        // resolver el formulario.
        if (dirty && !puedeGuardar) return null;

        setGuardando(true);
        try {
            const actual = dirty ? await persistir(pagina) : pagina;
            const respuesta = await despublicarPaginaContenido(Number(actual.id));
            const despublicada = mapearPagina(respuesta.pagina);
            setPagina(despublicada);
            setDirty(false);
            setErroresCampo({});
            setDetallesPublicacion([]);
            return despublicada;
        } catch (err) {
            manejarError(err);
            return null;
        } finally {
            setGuardando(false);
        }
    }, [pagina, dirty, puedeGuardar, persistir, manejarError]);

    const eliminar = useCallback(async (): Promise<boolean> => {
        if (!pagina || esNueva) return false;

        setGuardando(true);
        try {
            await eliminarPaginaContenido(Number(pagina.id));
            return true;
        } catch (err) {
            manejarError(err);
            return false;
        } finally {
            setGuardando(false);
        }
    }, [pagina, esNueva, manejarError]);

    const recargar = useCallback(() => {
        setLoading(true);
        setNoEncontrada(false);
        setErrorCarga(null);
        setRecarga((valor) => valor + 1);
    }, []);

    return {
        esNueva,
        pagina,
        loading,
        noEncontrada,
        errorCarga,
        recargar,
        dirty,
        guardando,
        subidasPendientes,
        puedeGuardar,
        puedePublicar,
        requisitos,
        errorSlug,
        verificandoSlug,
        slugDisponible,
        erroresCampo,
        detallesPublicacion,
        cambiarTitulo,
        cambiarSlug,
        cambiarDescripcion,
        cambiarVisibleEnMenu,
        cambiarOrden,
        cambiarPortada,
        agregarBloque,
        actualizarBloque,
        moverBloque,
        eliminarBloque,
        guardar,
        publicar,
        despublicar,
        eliminar
    };
}
