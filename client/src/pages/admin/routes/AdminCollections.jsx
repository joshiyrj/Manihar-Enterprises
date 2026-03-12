import { Layers } from "lucide-react";
import DataManagementPanel from "../components/DataManagementPanel";

const columns = [
  { key: "name", label: "Name", required: true, placeholder: "e.g. Summer Collection" },
];

const modalFields = [
  { key: "name", label: "Name", required: true, placeholder: "e.g. Summer Collection" },
  { key: "tags", label: "Tags (comma separated)", placeholder: "e.g. featured, new, sale" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Optional description...", fullWidth: true },
];

export default function AdminCollections() {
  return (
    <DataManagementPanel
      title="Collections"
      subtitle="Search, filter, create and edit collections."
      apiBase="/api/entities"
      queryKey="collections-panel"
      columns={columns}
      modalFields={modalFields}
      defaultNewItem={{ name: "", tags: "", description: "", status: "active" }}
      icon={<Layers size={22} />}
      identifierField="name"
      useEntityApi={true}
      entityType="collection"
    />
  );
}