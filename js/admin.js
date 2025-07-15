import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { firebaseConfig, appConfig } from "./config.js";

// Firebase init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos UI
const panel = document.getElementById("panel");
const loadingHTML =
  '<div class="loading"><div class="spinner"></div>Cargando...</div>';

// Estado
let currentUser = null;
let suggestions = [];

/* -------------------- FUNCIONES -------------------- */

function isAdmin(email) {
  return appConfig.adminEmails.includes(email);
}

function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user && isAdmin(user.email)) {
      renderBaseLayout(); // Se llama solo si está logueado y es admin
      loadSuggestions();
    } else {
      showLogin();
    }
  });
}

async function showLogin() {
  panel.innerHTML = loadingHTML;

  const { value: credentials } = await Swal.fire({
    title: "Acceso Administrador",
    html:
      '<input id="swal-email" class="swal2-input" placeholder="usuario@tudominio.com">' +
      '<input id="swal-password" type="password" class="swal2-input" placeholder="Contraseña">',
    focusConfirm: false,
    preConfirm: () => {
      return {
        email: document.getElementById("swal-email").value.trim(),
        password: document.getElementById("swal-password").value.trim(),
      };
    },
  });

  if (credentials) {
    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (!isAdmin(credentials.email)) {
        await signOut(auth);
        throw new Error("Acceso no autorizado");
      }
    } catch (error) {
      Swal.fire("Error", error.message, "error");
      showLogin();
    }
  }
}

function renderBaseLayout() {
  panel.innerHTML = `
    <div class="panel-header">
      <h1><span><i class="fas fa-envelope"></i> BSS</span></h1>
      <div class="header-actions">
        <button id="btnStats" class="btn-icon" title="Estadísticas"><i class="fas fa-chart-bar"></i></button>
        <button id="btnExport" class="btn-icon" title="Exportar"><i class="fas fa-download"></i></button>
        <button id="btnRefresh" class="btn-icon" title="Actualizar"><i class="fas fa-rotate-right"></i></button>
        <button id="btnLogout" class="btn-icon" title="Cerrar sesión"><i class="fas fa-right-from-bracket"></i></button>
      </div>
    </div>
    <div class="panel-filters">
      <select id="filterStatus">
        <option value="all">Todas</option>
        <option value="read">Leídas</option>
        <option value="unread">No leídas</option>
      </select>
      <select id="filterCategory">
        <option value="all">Todas las categorías</option>
        ${appConfig.suggestionCategories
          .map((cat) => `<option value="${cat}">${cat}</option>`)
          .join("")}
      </select>
      <input type="text" id="searchInput" placeholder="Buscar...">
    </div>
    <div id="suggestionsContainer" class="suggestions-container"></div>
    <footer class="panel-footer">
      <p>&copy; 2025. Ing. Pedro Garcia.</p>
    </footer>
  `;

  // Eventos
  document.getElementById("btnLogout").addEventListener("click", logout);
  document.getElementById("btnRefresh").addEventListener("click", loadSuggestions);
  document.getElementById("btnExport").addEventListener("click", exportToExcel);
  document.getElementById("btnStats").addEventListener("click", showStats);
  document.getElementById("filterStatus").addEventListener("change", filterSuggestions);
  document.getElementById("filterCategory").addEventListener("change", filterSuggestions);
  document.getElementById("searchInput").addEventListener("input", filterSuggestions);
}

async function loadSuggestions() {
  const container = document.getElementById("suggestionsContainer");
  if (!container) return;

  container.innerHTML = loadingHTML;

  try {
    const q = query(collection(db, "sugerencias"), orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);
    suggestions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderSuggestions(suggestions);
  } catch (err) {
    console.error("Error al cargar sugerencias:", err);
    Swal.fire("Error", "No se pudieron cargar las sugerencias", "error");
  }
}

function filterSuggestions() {
  const status = document.getElementById("filterStatus").value;
  const category = document.getElementById("filterCategory").value;
  const search = document.getElementById("searchInput").value.toLowerCase();

  const filtered = suggestions.filter((s) => {
    const matchesStatus =
      status === "all" || (status === "read" && s.leido) || (status === "unread" && !s.leido);
    const matchesCategory = category === "all" || s.categoria === category;
    const matchesSearch =
      s.mensaje.toLowerCase().includes(search) ||
      (s.nombre || "").toLowerCase().includes(search);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  renderSuggestions(filtered);
}

function renderSuggestions(list) {
  const container = document.getElementById("suggestionsContainer");
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = "<p class='empty'>No hay sugerencias para mostrar.</p>";
    return;
  }

  container.innerHTML = list
    .map(
      (s, index) => `
      <div class="suggestion ${s.leido ? "read" : "unread"}" style="animation-delay: ${index * 100}ms">
        <div class="categoria">${getCategoryIcon(s.categoria)}</div>
        <p class="categoria-text">${s.categoria}</p>
        <p class="usuario">${s.nombre || "Anónimo"}</p>
        <p class="mensaje">${s.mensaje}</p>
        <div class="actions">
          <button class="btn-toggle" onclick="toggleRead('${s.id}', ${s.leido})">
            ${s.leido ? '<i class="fas fa-envelope-open-text"></i>' : '<i class="fas fa-envelope"></i>'}
          </button>
          <button class="btn-delete" onclick="deleteSuggestion('${s.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <p class="date">${new Date(s.fecha?.seconds * 1000).toLocaleString()}</p>
      </div>
    `
    )
    .join("");
}

async function toggleRead(id, currentState) {
  try {
    const ref = doc(db, "sugerencias", id);
    await updateDoc(ref, { leido: !currentState });
    loadSuggestions();
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    Swal.fire("Error", "No se pudo actualizar el estado", "error");
  }
}

async function deleteSuggestion(id) {
  const confirm = await Swal.fire({
    title: "¿Eliminar sugerencia?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  });

  if (confirm.isConfirmed) {
    try {
      await deleteDoc(doc(db, "sugerencias", id));
      loadSuggestions();
    } catch (err) {
      console.error("Error al eliminar:", err);
      Swal.fire("Error", "No se pudo eliminar la sugerencia", "error");
    }
  }
}
async function exportToExcel() {
  if (suggestions.length === 0)
    return Swal.fire("Nada que exportar", "", "info");

  const { value: selectedDate } = await Swal.fire({
    title: "Selecciona una fecha",
    html: `<input type="date" id="excel-date" class="swal2-input">`,
    confirmButtonText: "Exportar",
    focusConfirm: false,
    preConfirm: () => {
      const date = document.getElementById("excel-date").value;
      if (!date) {
        Swal.showValidationMessage("Debes seleccionar una fecha");
        return false;
      }
      return date;
    },
  });

  if (!selectedDate) return;

  const selectedDay = new Date(selectedDate + "T00:00:00Z");
  const nextDay = new Date(selectedDay);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const filtered = suggestions.filter((s) => {
    const sDate = new Date(s.fecha?.seconds * 1000);
    return sDate >= selectedDay && sDate < nextDay;
  });

  if (filtered.length === 0)
    return Swal.fire("No hay sugerencias para esa fecha", "", "info");

  const headers = ["Nombre", "Categoría", "Mensaje", "Leído", "Fecha"];
  const rows = filtered.map((s) => [
    s.nombre || "Anónimo",
    s.categoria,
    s.mensaje,
    s.leido ? "Sí" : "No",
    new Date(s.fecha?.seconds * 1000).toLocaleString(),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sugerencias");

  const fileName = `sugerencias_${selectedDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

async function exportToCSV() {
  if (suggestions.length === 0)
    return Swal.fire("Nada que exportar", "", "info");

  const { value: selectedDate } = await Swal.fire({
    title: "Selecciona una fecha",
    html: `<input type="date" id="csv-date" class="swal2-input">`,
    confirmButtonText: "Exportar",
    focusConfirm: false,
    preConfirm: () => {
      const date = document.getElementById("csv-date").value;
      if (!date) {
        Swal.showValidationMessage("Debes seleccionar una fecha");
        return false;
      }
      return date;
    },
  });

  if (!selectedDate) return;

  const selectedDay = new Date(selectedDate + "T00:00:00Z");
  const nextDay = new Date(selectedDay);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const filtered = suggestions.filter((s) => {
    const sDate = new Date(s.fecha?.seconds * 1000);
    return sDate >= selectedDay && sDate < nextDay;
  });

  if (filtered.length === 0) {
    return Swal.fire("No hay sugerencias para esa fecha", "", "info");
  }

  const headers = ["Nombre", "Categoría", "Mensaje", "Leído", "Fecha"];
  const rows = filtered.map((s) => [
    s.nombre || "Anónimo",
    s.categoria,
    `"${s.mensaje.replace(/"/g, '""')}"`,
    s.leido ? "Sí" : "No",
    new Date(s.fecha?.seconds * 1000).toLocaleString(),
  ]);

  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sugerencias_${selectedDate}.csv`;
  link.click();
}

function showStats() {
  const total = suggestions.length;
  const leidas = suggestions.filter((s) => s.leido).length;
  const noLeidas = total - leidas;

  const porCategoria = appConfig.suggestionCategories
    .map((cat) => {
      const count = suggestions.filter((s) => s.categoria === cat).length;
      return `${cat}: ${count}`;
    })
    .join("\n");

  Swal.fire({
    title: "📊 Estadísticas",
    icon: "info",
    html: `
      <p><strong>Total:</strong> ${total}</p>
      <p><strong>Leídas:</strong> ${leidas}</p>
      <p><strong>No leídas:</strong> ${noLeidas}</p>
      <hr>
      <pre style="text-align:left;">${porCategoria}</pre>
    `,
  });
}

async function logout() {
  await signOut(auth);
  showLogin();
}

function getCategoryIcon(categoria) {
  switch (categoria.toLowerCase()) {
    case "sugerencia":
      return '<i class="fas fa-lightbulb" style="color:#fbc02d;"></i>';
    case "queja":
      return '<i class="fas fa-triangle-exclamation" style="color:#e53935;"></i>';
    case "felicitación":
      return '<i class="fas fa-thumbs-up" style="color:#43a047;"></i>';
    case "otro":
      return '<i class="fas fa-ellipsis" style="color:#757575;"></i>';
    default:
      return '<i class="fas fa-comment-dots" style="color:#607d8b;"></i>';
  }
}

// Exponer funciones para los botones
window.deleteSuggestion = deleteSuggestion;
window.toggleRead = toggleRead;

/* ---------- INICIO ----------- */
setupAuthListener(); // Se llama solo cuando ya todo está definido
