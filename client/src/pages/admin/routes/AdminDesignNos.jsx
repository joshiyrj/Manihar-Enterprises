import { Paintbrush } from "lucide-react";
import DataManagementPanel from "../components/DataManagementPanel";

const columns = [
    { key: "designNumber", label: "Design No.", required: true, placeholder: "e.g. D-1001" },
];

export default function AdminDesignNos() {
    return (
        <DataManagementPanel
            title="Design Nos"
            subtitle="Catalog and organize fabric design patterns."
            apiBase="/api/design-nos"
            queryKey="design-nos"
            columns={columns}
            defaultNewItem={{ designNumber: "", status: "active", notes: "" }}
            icon={<Paintbrush size={22} />}
            identifierField="designNumber"
        />
    );
}
