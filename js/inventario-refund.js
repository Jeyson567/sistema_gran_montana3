import { ajustarStockInventario } from "../firebase/firestore.js";

/** Descuentos ya aplicados en adicionales al agregar al carrito */
export const descuentosAdicionalesCarrito = (carrito = []) => {
  const map = new Map();
  for (const linea of carrito) {
    const inv = linea?.inventarioDescuento;
    if (!inv?.inventarioId) continue;
    const cant = Number(inv.cantidad ?? 0) * Number(linea.cantidad ?? 1);
    if (cant <= 0) continue;
    const prev = map.get(inv.inventarioId) ?? { inventarioId: inv.inventarioId, cantidad: 0, nombre: linea.nombre };
    prev.cantidad += cant;
    map.set(inv.inventarioId, prev);
  }
  return [...map.values()];
};

/** Descuentos de productos del menú (inventarioConfig) al cobrar */
export const descuentosMenuCarrito = (carrito = [], productos = []) => {
  const map = new Map();
  for (const linea of carrito) {
    if (!linea?.productoId) continue;
    const p = productos.find((x) => x.id === linea.productoId);
    if (!p?.descontarInventario || !Array.isArray(p.inventarioConfig)) continue;
    const qty = Number(linea.cantidad ?? 1);
    for (const ins of p.inventarioConfig) {
      if (!ins?.productoInventario) continue;
      const cant = Number(ins.cantidad ?? 0) * qty;
      if (cant <= 0) continue;
      const id = ins.productoInventario;
      const prev = map.get(id) ?? { inventarioId: id, cantidad: 0, nombre: p.nombre };
      prev.cantidad += cant;
      map.set(id, prev);
    }
  }
  return [...map.values()];
};

export const snapshotInventarioVenta = (carrito = [], productos = []) => {
  const map = new Map();
  const addList = (list) => {
    for (const item of list) {
      if (!item?.inventarioId || item.cantidad <= 0) continue;
      const prev = map.get(item.inventarioId) ?? {
        inventarioId: item.inventarioId,
        cantidad: 0,
        nombre: item.nombre
      };
      prev.cantidad += item.cantidad;
      map.set(item.inventarioId, prev);
    }
  };
  addList(descuentosAdicionalesCarrito(carrito));
  addList(descuentosMenuCarrito(carrito, productos));
  return [...map.values()];
};

export const descontarInventarioItems = async ({ items, usuario, motivo, tipoMovimiento = "salida" }) => {
  for (const item of items) {
    if (!item?.inventarioId || item.cantidad <= 0) continue;
    await ajustarStockInventario({
      inventarioId: item.inventarioId,
      cantidad: item.cantidad,
      tipoMovimiento,
      motivo: `${motivo} — ${item.nombre ?? item.inventarioId}`,
      usuario
    });
  }
};

export const reembolsarInventarioItems = async ({ items, usuario, motivo }) => {
  await descontarInventarioItems({
    items,
    usuario,
    motivo,
    tipoMovimiento: "reembolso"
  });
};

export const reembolsarInventarioCarritoMesa = async ({ carrito, usuario, motivo }) => {
  const items = descuentosAdicionalesCarrito(carrito);
  if (!items.length) return;
  await reembolsarInventarioItems({ items, usuario, motivo });
};
