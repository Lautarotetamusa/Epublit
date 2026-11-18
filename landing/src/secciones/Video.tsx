export function Video() {
    return (
        <section id="video" className="l-video" aria-labelledby="video-titulo">
            <div className="l-contenedor">
                <div className="l-encabezado-seccion">
                    <h2 id="video-titulo">Mirá Epublit funcionando</h2>
                    <p className="l-seccion-bajada">En un minuto: consignaciones, regalías, facturación y tienda.</p>
                </div>
                <div className="l-video-marco">
                    {/* Sin autoplay y con preload="none": el video pesa varios MB y sólo se baja si la persona le da play. */}
                    <video controls preload="none" playsInline poster="/video/epublit-demo-poster.webp" width={1280} height={720}>
                        <source src="/video/epublit-demo.mp4" type="video/mp4" />
                        Tu navegador no puede reproducir el video. <a href="/video/epublit-demo.mp4">Descargalo acá</a>.
                    </video>
                </div>
            </div>
        </section>
    );
}
