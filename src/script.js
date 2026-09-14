/* Ficha SOS Brigadista v5 — 100% offline, sin backend, sanitización manual */

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(match) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[match];
  });
}

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.className = tipo;
  el.textContent = texto;
}

function obtenerGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 'No disponible', lon: 'No disponible' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ 
        lat: pos.coords.latitude.toFixed(6), 
        lon: pos.coords.longitude.toFixed(6) 
      }),
      err => {
        console.warn('GPS no disponible:', err.message);
        resolve({ lat: 'No disponible', lon: 'No disponible' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function generarPDF() {
  const nombre = escapeHTML(document.getElementById('nombre').value);
  const dni = escapeHTML(document.getElementById('dni').value);
  const edad = escapeHTML(document.getElementById('edad').value);
  const tel = escapeHTML(document.getElementById('telEmergencia').value);
  const condicion = escapeHTML(document.getElementById('condicionMedica').value);
  const estado = escapeHTML(document.getElementById('estado').value);

  if (!nombre || !dni || !edad || !tel || !estado) {
    mostrarMensaje('❌ Faltan campos obligatorios', 'error');
    return;
  }

  mostrarMensaje('📡 Obteniendo GPS...', 'ok');
  const gps = await obtenerGPS();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const fecha = new Date().toLocaleString('es-AR');

  doc.setFontSize(18);
  doc.setTextColor(200, 30, 30);
  doc.text('🚨 FICHA SOS BRIGADISTA', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado: ${fecha}`, 20, 28);
  
  doc.setDrawColor(200, 30, 30);
  doc.line(20, 32, 190, 32);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  let y = 45;
  const linea = (label, valor) => {
    doc.setFont(undefined, 'bold');
    doc.text(label + ':', 20, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(valor), 80, y);
    y += 10;
  };
  
  linea('Nombre', nombre);
  linea('DNI', dni);
  linea('Edad', edad);
  linea('Tel. Emergencia', tel);
  linea('Condición Médica', condicion || 'No especificada');
  linea('Estado Actual', estado);
  linea('Latitud GPS', gps.lat);
  linea('Longitud GPS', gps.lon);
  
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Ficha generada offline desde el celular del brigadista.', 20, y);
  doc.text('Enviar por WhatsApp a Defensa Civil ante emergencia.', 20, y + 5);

  const fileName = `FichaSOS_${dni}_${Date.now()}.pdf`;
  doc.save(fileName);
  mostrarMensaje('✅ Ficha PDF generada correctamente', 'ok');
}

document.getElementById('generarPdf').addEventListener('click', generarPDF);
