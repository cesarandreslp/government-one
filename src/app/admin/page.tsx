import { redirect } from "next/navigation"

// La raíz del admin del tenant redirige a la primera sección disponible (estructura).
export default function AdminIndex() {
  redirect("/admin/estructura")
}
