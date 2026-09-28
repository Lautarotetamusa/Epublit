// Barrel único del sistema de diseño: se importa siempre desde acá
// ("./design-system" o "../design-system"), nunca apuntando directo a un
// archivo dentro de components/**. Esa regla está reforzada en
// adherence.oxlintrc.json (no-restricted-imports).
export { Avatar } from "./components/core/Avatar.jsx";
export { Badge } from "./components/core/Badge.jsx";
export { Button } from "./components/core/Button.jsx";
export { Card } from "./components/core/Card.jsx";
export { Icon } from "./components/core/Icon.jsx";
export { IconButton } from "./components/core/IconButton.jsx";
export { StatCard } from "./components/core/StatCard.jsx";

export { EmptyState } from "./components/data/EmptyState.jsx";
export { Pagination } from "./components/data/Pagination.jsx";
export { Table } from "./components/data/Table.jsx";

export { Alert } from "./components/feedback/Alert.jsx";
export { Dialog } from "./components/feedback/Dialog.jsx";
export { Toast } from "./components/feedback/Toast.jsx";
export { Tooltip } from "./components/feedback/Tooltip.jsx";

export { Checkbox } from "./components/forms/Checkbox.jsx";
export { Combobox } from "./components/forms/Combobox.jsx";
export { CoverUpload } from "./components/forms/CoverUpload.jsx";
export { Field } from "./components/forms/Field.jsx";
export { Input } from "./components/forms/Input.jsx";
export { PhotoUpload } from "./components/forms/PhotoUpload.jsx";
export { QuantityStepper } from "./components/forms/QuantityStepper.jsx";
export { Radio } from "./components/forms/Radio.jsx";
export { Select } from "./components/forms/Select.jsx";
export { SegmentedControl } from "./components/forms/SegmentedControl.jsx";
export { Switch } from "./components/forms/Switch.jsx";
export { Textarea } from "./components/forms/Textarea.jsx";

export { Breadcrumb } from "./components/navigation/Breadcrumb.jsx";
export { SidebarNav } from "./components/navigation/SidebarNav.jsx";
export { Tabs } from "./components/navigation/Tabs.jsx";
export { Topbar } from "./components/navigation/Topbar.jsx";
