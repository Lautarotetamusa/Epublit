import { Icon } from "../design-system";

export function FullscreenSpinner() {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
            <Icon name="loader-circle" size={32} color="var(--pino-600)" style={{ animation: "epublit-spin 900ms linear infinite" }} />
        </div>
    );
}
