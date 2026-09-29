import { useState } from "react";
import { Button, Dialog } from "../../design-system";
import type { Deposito } from "../../api/deposito";
import type { DepositoFormValues } from "./DepositoFormFields";
import { DepositoFormFields, isDepositoFormValid } from "./DepositoFormFields";

type Props = {
    // Sin depósito es alta; con depósito, edición.
    deposito?: Deposito;
    onClose: () => void;
    onGuardar: (input: { nombre: string; descripcion: string }) => Promise<void>;
};

export function DepositoFormDialog({ deposito, onClose, onGuardar }: Props) {
    const [values, setValues] = useState<DepositoFormValues>({
        nombre: deposito?.nombre ?? "",
        descripcion: deposito?.descripcion ?? ""
    });
    const [saving, setSaving] = useState(false);

    const handleGuardar = async () => {
        setSaving(true);
        await onGuardar({ nombre: values.nombre, descripcion: values.descripcion });
        setSaving(false);
    };

    return (
        <Dialog
            open
            title={deposito ? "Editar depósito" : "Nuevo depósito"}
            description="Un depósito es un lugar donde tenés libros. El principal se crea con tu cuenta y no se puede eliminar."
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleGuardar} loading={saving} disabled={!isDepositoFormValid(values)}>
                        {deposito ? "Guardar cambios" : "Crear depósito"}
                    </Button>
                </>
            }
        >
            <DepositoFormFields values={values} onChange={(patch) => setValues((actual) => ({ ...actual, ...patch }))} />
        </Dialog>
    );
}
