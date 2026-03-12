import { Factory } from "lucide-react";
import DataManagementPanel from "../components/DataManagementPanel";

const columns = [
    { key: "name", label: "Name", required: true, placeholder: "e.g. Lakshmi Mills" },
];

export default function AdminMills() {
    return (
        <DataManagementPanel
            title="Mills"
            subtitle="Add, edit, and organize mill records."
            apiBase="/api/mills"
            queryKey="mills"
            columns={columns}
            defaultNewItem={{ name: "", status: "active", notes: "" }}
            icon={<Factory size={22} />}
            identifierField="name"
        />
    );
}
