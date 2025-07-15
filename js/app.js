import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, collection, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementos del DOM
const openFormButton = document.getElementById('openForm');

// Evento del botón
openFormButton.addEventListener('click', async () => {
  try {
    const { value: formData } = await Swal.fire({
      title: '¡Danos tu opinión!',
      html: `
        <div class="form-container">
          <input 
            id="swal-name" 
            class="swal2-input" 
            placeholder="Tu nombre (opcional)"
            maxlength="50"
          >
          <select id="swal-category" class="swal2-select">
            <option value="" disabled selected>Selecciona una categoría</option>
            <option value="Sugerencia">Sugerencia</option>
            <option value="Queja">Queja</option>
            <option value="Felicitación">Felicitación</option>
            <option value="Otro">Otro</option>
          </select>
          <textarea 
            id="swal-message" 
            class="swal2-textarea" 
            placeholder="Escribe tu mensaje aquí..."
            rows="5"
            maxlength="500"
          ></textarea>
          <div class="char-counter"><span id="char-count">0</span>/500 caracteres</div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return {
          name: document.getElementById('swal-name').value.trim(),
          category: document.getElementById('swal-category').value,
          message: document.getElementById('swal-message').value.trim()
        };
      },
      didOpen: () => {
        // Contador de caracteres
        const textarea = document.getElementById('swal-message');
        const charCount = document.getElementById('char-count');
        
        textarea.addEventListener('input', () => {
          charCount.textContent = textarea.value.length;
        });
      }
    });

    if (formData) {
      // Validación
      if (!formData.category) {
        Swal.showValidationMessage('Por favor selecciona una categoría');
        return false;
      }
      
      if (!formData.message) {
        Swal.showValidationMessage('Por favor escribe tu mensaje');
        return false;
      }

      // Mostrar loader
      Swal.fire({
        title: 'Enviando tu sugerencia...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Enviar a Firestore
      const docRef = await addDoc(collection(db, "sugerencias"), {
        nombre: formData.name || "Anónimo",
        categoria: formData.category,
        mensaje: formData.message,
        fecha: serverTimestamp(),
        leida: false
      });

      // Mostrar confirmación
      Swal.fire({
        title: '¡Gracias!',
        html: `
          <div style="text-align:center;">
            <p>Tu sugerencia ha sido enviada con éxito.</p>
            <small>ID: ${docRef.id}</small>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    }
  } catch (error) {
    console.error("Error al enviar sugerencia:", error);
    Swal.fire({
      title: 'Error',
      text: 'Ocurrió un problema al enviar tu sugerencia. Por favor inténtalo nuevamente.',
      icon: 'error'
    });
  }
});