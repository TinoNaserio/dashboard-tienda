async function fetchCSV(path) {
  const res = await fetch(path);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row = {};
    headers.forEach((h, idx) => row[h] = (cols[idx] ?? "").trim());
    rows.push(row);
  }
  return rows;
}

function setKPI(id, value) {
  document.getElementById(id).textContent = value;
}

function renderTable(tableId, rows, columns, headersMap) {
  const table = document.getElementById(tableId);
  if (!rows.length) {
    table.innerHTML = "<tr><td>No hay datos</td></tr>";
    return;
  }

  let html = "<thead><tr>";
  columns.forEach(c => html += `<th>${headersMap[c] ?? c}</th>`);
  html += "</tr></thead><tbody>";

  rows.forEach(r => {
    html += "<tr>";
    columns.forEach(c => html += `<td>${r[c] ?? ""}</td>`);
    html += "</tr>";
  });

  html += "</tbody>";
  table.innerHTML = html;
}

function uniqueValues(rows, key) {
  const s = new Set();
  rows.forEach(r => s.add(r[key]));
  return Array.from(s).filter(v => v !== undefined && v !== "");
}

function fillSelect(selectId, values, allLabel) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = allLabel;
  sel.appendChild(optAll);

  values.sort().forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function applyFilters(rows, estado, nivel) {
  return rows.filter(r => {
    const okEstado = !estado || r["Estado"] === estado;
    const okNivel = !nivel || r["Nivel_de_rentabilidad"] === nivel;
    return okEstado && okNivel;
  });
}

let chart1 = null;
let chart2 = null;

function renderChartBeneficioNivel(rows) {
  const labels = rows.map(r => r["Nivel_de_rentabilidad"]);
  const data = rows.map(r => Number(r["beneficio_total"]));

  const ctx = document.getElementById("chartBeneficioNivel");
  if (chart1) chart1.destroy();

  chart1 = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Beneficio total", data }]
    }
  });
}

function renderChartVentasEstado(rows) {
  const labels = rows.map(r => r["Estado"]);
  const data = rows.map(r => Number(r["num_ventas"]));

  const ctx = document.getElementById("chartVentasEstado");
  if (chart2) chart2.destroy();

  chart2 = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Número de ventas", data }]
    }
  });
}

async function init() {
  // Cargar CSV
  const kpis = await fetchCSV("data/kpis.csv");
  const beneficioNivel = await fetchCSV("data/beneficio_por_nivel.csv");
  const ventasEstado = await fetchCSV("data/ventas_por_estado.csv");
  const topProductos = await fetchCSV("data/top_productos_beneficio.csv");

  // Pintar KPIs
  if (kpis.length) {
    setKPI("kpiRegistros", kpis[0]["num_registros"]);
    setKPI("kpiUnidades", kpis[0]["total_unidades"]);
    setKPI("kpiBeneficioTotal", kpis[0]["beneficio_total"]);
    setKPI("kpiBeneficioMedio", kpis[0]["beneficio_medio"]);
  }

  // Gráficas (no dependen de filtros en este ejemplo)
  renderChartBeneficioNivel(beneficioNivel);
  renderChartVentasEstado(ventasEstado);

  // Tablas
  renderTable(
    "tablaTopProductos",
    topProductos,
    ["Producto", "beneficio_total", "unidades"],
    { Producto: "Producto", beneficio_total: "Beneficio total", unidades: "Unidades" }
  );

  renderTable(
    "tablaVentasEstado",
    ventasEstado,
    ["Estado", "num_ventas", "unidades"],
    { Estado: "Estado", num_ventas: "Nº ventas", unidades: "Unidades" }
  );

  // Filtros: para que funcionen de verdad necesitamos datos “fila a fila”.
  // Como ahora estamos usando CSV agregados, haremos filtros sobre una tabla que sí tenga Estado y Nivel.
  // Solución: exportar un CSV adicional con detalle.
  // Para esta práctica, vamos a generar un CSV de detalle.
  // Si no existe, se desactivan filtros.
  let detalle = [];
  try {
    detalle = await fetchCSV("data/detalle.csv");
  } catch (e) {
    detalle = [];
  }

  const filtroEstado = document.getElementById("filtroEstado");
  const filtroNivel = document.getElementById("filtroNivel");
  const btnReset = document.getElementById("btnReset");

  if (!detalle.length) {
    filtroEstado.innerHTML = "<option>Sin detalle.csv</option>";
    filtroNivel.innerHTML = "<option>Sin detalle.csv</option>";
    filtroEstado.disabled = true;
    filtroNivel.disabled = true;
    btnReset.disabled = true;
    return;
  }

  fillSelect("filtroEstado", uniqueValues(detalle, "Estado"), "Todos los estados");
  fillSelect("filtroNivel", uniqueValues(detalle, "Nivel_de_rentabilidad"), "Todos los niveles");

  function updateFiltered() {
    const estado = filtroEstado.value;
    const nivel = filtroNivel.value;
    const filtrado = applyFilters(detalle, estado, nivel);

    // Ejemplo: recalcular KPIs filtrados desde detalle
    const num = filtrado.length;
    const unidades = filtrado.reduce((acc, r) => acc + Number(r["Unidades_vendidas"] || 0), 0);
    const beneficio = filtrado.reduce((acc, r) => acc + Number(r["beneficio_total_num"] || 0), 0);

    setKPI("kpiRegistros", num);
    setKPI("kpiUnidades", unidades);
    setKPI("kpiBeneficioTotal", beneficio.toFixed(2));
    setKPI("kpiBeneficioMedio", num ? (beneficio / num).toFixed(2) : "0.00");
  }

  filtroEstado.addEventListener("change", updateFiltered);
  filtroNivel.addEventListener("change", updateFiltered);
  btnReset.addEventListener("click", () => {
    filtroEstado.value = "";
    filtroNivel.value = "";
    updateFiltered();
  });

  updateFiltered();
}

init();
