import { ROLES } from "../firebase/permissions.js";
import { logoutUser } from "../firebase/auth.js";

const menuByRole = {
  [ROLES.admin]: [
    { label: "Dashboard", href: "/dashboard.html" },
    { label: "Mesas", href: "/modules/mesero/mesero.html" },
    { label: "Cocina", href: "/modules/cocina/cocina.html" },
    { label: "Caja", href: "/modules/caja/caja.html" },
    { label: "Reimpresión tickets", href: "/modules/reimpresion/reimpresion.html" },
    { label: "Productos", href: "/modules/admin/admin.html#productos" },
    { label: "Categorías", href: "/modules/admin/admin.html#categorias" },
    { label: "Inventario", href: "/modules/admin/admin.html#inventario" },
    { label: "Usuarios", href: "/modules/admin/admin.html#usuarios" },
    { label: "Reportes", href: "/modules/admin/admin.html#reportes" },
    { label: "Configuración", href: "/modules/admin/admin.html#configuracion" }
  ],
  [ROLES.mesero]: [{ label: "Mesas y pedidos", href: "/modules/mesero/mesero.html" }],
  [ROLES.cocina]: [{ label: "Monitor Cocina", href: "/modules/cocina/cocina.html" }],
  [ROLES.caja]: [
    { label: "Cobros", href: "/modules/caja/caja.html" },
    { label: "Historial", href: "/modules/caja/caja.html#historial" },
    { label: "Reimpresión tickets", href: "/modules/reimpresion/reimpresion.html" }
  ]
};

export const buildSidebar = (rol) => {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const menu = menuByRole[rol] ?? [];
  const path = window.location.pathname + window.location.hash;

  sidebar.innerHTML = `
    <div class="mb-6">
      <p class="text-zinc-400 text-xs tracking-widest">GRAN MONTANA</p>
      <h2 class="font-bold text-lg mt-1 uppercase text-orange-400">${rol}</h2>
    </div>
    <nav class="space-y-1 flex-1 overflow-y-auto">
      ${menu
        .map((item) => {
          const active = path === item.href || path.startsWith(item.href.split("#")[0]);
          return `<a href="${item.href}" class="block px-3 py-2 rounded-xl text-sm font-medium transition ${active ? "bg-orange-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"}">${item.label}</a>`;
        })
        .join("")}
    </nav>
    <button type="button" id="sidebar-logout" class="btn-danger w-full mt-6 text-sm shrink-0">Cerrar sesión</button>
  `;

  document.getElementById("sidebar-logout")?.addEventListener("click", async () => {
    await logoutUser();
    window.location.replace("/login.html");
  });
};
