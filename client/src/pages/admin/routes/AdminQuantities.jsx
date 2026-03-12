import { BoxSelect } from "lucide-react";
import DataManagementPanel from "../components/DataManagementPanel";

const columns = [
    { key: "label", label: "Name", required: true, placeholder: "e.g. 500 Meters" },
];

export default function AdminQuantities() {
    return (
        <DataManagementPanel
            title="Quantities"
            subtitle="Define standard quantities and units."
            apiBase="/api/quantities"
            queryKey="quantities"
            columns={columns}
            defaultNewItem={{ label: "", status: "active", notes: "" }}
            icon={<BoxSelect size={22} />}
            identifierField="label"
        />
    );
}
