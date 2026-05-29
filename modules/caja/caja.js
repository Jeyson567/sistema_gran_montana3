import { listenMesas, listenVentas, cobrarMesaConTicket } from "../../firebase/firestore.js";
import { protectModule } from "../../js/guard.js";
import { buildSidebar } from "../../components/sidebar.js";
import { openFormModal } from "../../components/modal.js";
import { formatCurrency, escapeHtml, toNumber, normalizeRecord } from "../../js/helpers.js";
import { alertSuccess, alertError } from "../../js/alerts.js";
import { getCurrentProfile } from "../../js/guard.js";
import { printTicket } from "../../js/print-ticket.js";

let mesasCache = [];
let ventasCache = [];
let profileCache = null;

const nowParts = () => {
  const d = new Date();
  return {
    fecha: d.toLocaleDateString("es-GT"),
    hora: d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })
  };
};

const renderMesasCobro = () => {
  const list = document.getElementById("cashier-list");
  if (!list) return;

  const pendientes = mesasCache.filter(
    (m) => m?.activa !== false && ["ocupada", "cobrando"].includes(m?.estado) && (m?.total ?? 0) > 0
  );

  if (!pendientes.length) {
    list.innerHTML = `<p class="text-zinc-500 col-span-full">No hay mesas pendientes de cobro.</p>`;
    return;
  }

  list.innerHTML = pendientes
    .map(
      (m) => `
    <article class="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
      <h3 class="font-bold text-lg">${escapeHtml(m.numero ?? "Mesa")}</h3>
      <p class="text-sm text-zinc-400">Estado: ${m.estado}</p>
      <p class="text-sm">Mesero: ${escapeHtml(m.meseroAsignado || "—")}</p>
      <p class="text-xl text-orange-400 font-bold mt-2">${formatCurrency(m.total ?? 0)}</p>
      <button type="button" class="btn-primary w-full mt-3 min-h-[48px]" data-cobrar-mesa="${m.id}">Cobrar mesa</button>
    </article>
  `
    )
    .join("");
};

const renderHistorial = () => {
  const tbody = document.getElementById("historial-ventas");
  if (!tbody) return;

  if (!ventasCache.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-zinc-500">Sin ventas registradas</td></tr>`;
    return;
  }

  tbody.innerHTML = ventasCache
    .map(
      (v) => `
    <tr class="border-b border-zinc-800">
      <td class="p-3 font-mono">${escapeHtml(v.ticket ?? "")}</td>
      <td class="p-3">${escapeHtml(v.mesa ?? "")}</td>
      <td class="p-3 text-right">${formatCurrency(v.subtotal ?? 0)}</td>
      <td class="p-3 text-right">${formatCurrency(v.propina ?? 0)}</td>
      <td class="p-3 text-right font-bold">${formatCurrency(v.total ?? 0)}</td>
      <td class="p-3">${escapeHtml(v.metodoPago ?? "")}</td>
      <td class="p-3">
        <button type="button" class="btn-secondary text-xs" data-reprint="${v.id}">Reimprimir</button>
      </td>
    </tr>
  `
    )
    .join("");
};

const openCobroModal = (mesa) => {
  const m = normalizeRecord(mesa);
  if (!m.id) return;

  const subtotal = toNumber(m.total, 0);

  openFormModal({
    title: `Cobrar — ${m.numero ?? "Mesa"}`,
    size: "md",
    formHtml: `
      <p class="text-zinc-400 text-sm">Subtotal consumo: <strong class="text-white" id="lbl-subtotal">${formatCurrency(subtotal)}</strong></p>
      <div>
        <label class="block text-sm mb-1">Propina (manual)</label>
        <input name="propina" id="input-propina" type="number" min="0" step="0.01" class="input-base" value="0" />
        <p class="text-xs text-zinc-500 mt-1">Ingresa 0 si no hay propina</p>
      </div>
      <p class="text-lg font-bold">TOTAL: <span id="lbl-total" class="text-orange-400">${formatCurrency(subtotal)}</span></p>
      <div>
        <label class="block text-sm mb-1">Método de pago</label>
        <select name="metodoPago" class="input-base" required>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
      </div>
      <input type="hidden" name="subtotal" value="${subtotal}" />
    `,
    submitLabel: "Cobrar e imprimir",
    onSubmit: async (fd) => {
      const propina = Math.max(0, toNumber(fd.get("propina"), 0));
      const sub = Math.max(0, toNumber(fd.get("subtotal"), 0));
      const total = sub + propina;
      const metodoPago = fd.get("metodoPago");
      const { fecha, hora } = nowParts();
      const mesero = m.meseroAsignado || profileCache?.nombre || "—";

      const ventaPayload = {
        mesa: m.numero ?? m.id,
        mesero,
        fecha,
        hora,
        productos:
          (Array.isArray(m.carrito) && m.carrito.length
            ? m.carrito.map((l) => ({
                nombre: l.esAdicional ? `${l.nombre} [Adicional]` : l.nombre,
                cantidad: l.cantidad ?? 1,
                subtotal: l.subtotal ?? l.precio ?? 0,
                notas: l.notas ?? "",
                esAdicional: !!l.esAdicional
              }))
            : null) ?? [{ nombre: "Consumo", cantidad: 1, subtotal: sub }],
        subtotal: sub,
        propina,
        total,
        metodoPago,
        estado: "pagado"
      };

      const result = await cobrarMesaConTicket({ mesaId: m.id, ventaPayload });
      const ventaImpresion = { ...ventaPayload, ticket: result.ticket, correlativo: result.correlativo };
      printTicket(ventaImpresion);
      alertSuccess(`Cobrado ${result.ticket}`);
    }
  });

  setTimeout(() => {
    const inputPropina = document.getElementById("input-propina");
    const lblTotal = document.getElementById("lbl-total");
    const updateTotal = () => {
      const prop = Math.max(0, toNumber(inputPropina?.value, 0));
      if (lblTotal) lblTotal.textContent = formatCurrency(subtotal + prop);
    };
    inputPropina?.addEventListener("input", updateTotal);
    updateTotal();
  }, 50);
};

const setupTabs = () => {
  if (location.hash === "#historial") {
    document.getElementById("view-cobros")?.classList.add("hidden");
    document.getElementById("view-historial")?.classList.remove("hidden");
  }
};

document.getElementById("cashier-list")?.addEventListener("click", (e) => {
  const id = e.target.closest("[data-cobrar-mesa]")?.dataset.cobrarMesa;
  if (!id) return;
  const mesa = mesasCache.find((m) => m.id === id);
  if (mesa) openCobroModal(mesa);
});

document.getElementById("historial-ventas")?.addEventListener("click", (e) => {
  const id = e.target.closest("[data-reprint]")?.dataset.reprint;
  if (!id) return;
  const venta = ventasCache.find((v) => v.id === id);
  if (venta) printTicket(venta);
  else alertError("Venta no encontrada");
});

protectModule("caja", (profile) => {
  profileCache = profile;
  buildSidebar(profile.rol);
  setupTabs();

  listenMesas((items) => {
    mesasCache = items.filter(Boolean);
    renderMesasCobro();
  });

  listenVentas((items) => {
    ventasCache = items.filter(Boolean);
    renderHistorial();
  });
});
