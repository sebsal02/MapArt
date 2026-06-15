let map, marker, selectedCoord = null;
let places = [];
let imgRealData = '', imgIlusData = '';

// Sistema de Token Unico e Intransferible por dispositivo
function getOrGenerateToken() {
  var token = localStorage.getItem('mapArtUserToken');
  if (!token) {
    var randomId = Math.floor(1000 + Math.random() * 9000);
    token = 'Usuario-' + randomId;
    localStorage.setItem('mapArtUserToken', token);
  }
  return token;
}
var userToken = getOrGenerateToken();

// Cerrar modales con tecla Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modalQR = document.getElementById('modalQR');
    if (modalQR) modalQR.classList.remove('on');
    var modalCmp = document.getElementById('modalCmp');
    if (modalCmp) modalCmp.classList.remove('on');
    var modalImg = document.getElementById('modalImgFull');
    if (modalImg) modalImg.classList.remove('on');
  }
});

window.onload = () => {
  // Precargar ultimo autor usado
  var lastAuthor = localStorage.getItem('mapArtLastAuthor');
  if (lastAuthor) {
    var authorInput = document.getElementById('alumnoNombre');
    if (authorInput) {
      authorInput.value = lastAuthor;
      setTimeout(() => toast('Nombre de autor autocompletado.'), 1000);
    }
  }

  map = L.map('map').setView([19.4326, -99.1332], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  map.on('click', (e) => {
    selectedCoord = e.latlng;
    document.getElementById('coordInfo').innerHTML = 'Seleccion: Lat ' + e.latlng.lat.toFixed(4) + ', Lng ' + e.latlng.lng.toFixed(4);
    
    if (marker) map.removeLayer(marker);
    marker = L.circleMarker(e.latlng, { radius: 10, color: '#c8861a', weight: 3, fillColor: '#fff', fillOpacity: 0.9 }).addTo(map);
  });


  // Mostrar ID del usuario en la UI
  var idDisplay = document.getElementById('userIdDisplay');
  if (idDisplay) idDisplay.textContent = 'Tu ID: ' + userToken;
  
  // Precargar el historial de mapas en segundo plano para evitar pantalla vacia
  cargarHistorialMapas();
};

function cambiarTab(tab) {
  // Desactivar todos los tabs y paneles
  var allTabs = document.querySelectorAll('.tab');
  var allPanels = document.querySelectorAll('.panel');
  var i;
  for (i = 0; i < allTabs.length; i++) { allTabs[i].classList.remove('on'); }
  for (i = 0; i < allPanels.length; i++) { allPanels[i].classList.remove('on'); }
  
  // Activar el tab correcto por data-tab
  var activeBtn = document.querySelector('.tab[data-tab="' + tab + '"]');
  if (activeBtn) activeBtn.classList.add('on');
  
  // Activar el panel correspondiente
  var activePanel = document.getElementById('tab-' + tab);
  if (activePanel) activePanel.classList.add('on');
  
  // Cargar historial automaticamente
  if (tab === 'historial') {
    cargarHistorialMapas();
  }
}

function previewImg(e, prevId) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(evt) {
    var dataUrl = evt.target.result;
    var img = document.getElementById(prevId);
    img.src = dataUrl;
    img.style.display = 'block';
    if (prevId === 'pvReal') imgRealData = dataUrl;
    if (prevId === 'pvIlus') imgIlusData = dataUrl;
    e.target.value = '';
  };
  reader.readAsDataURL(file);
}

function verImagen(src) {
  if (!src) return;
  document.getElementById('imgFullTarget').src = src;
  document.getElementById('modalImgFull').classList.add('on');
}

async function agregarLugar() {
  var name = document.getElementById('pNombre').value.trim();
  var authorName = document.getElementById('alumnoNombre').value.trim();
  
  if (!selectedCoord) return toast('Seleccione un lugar en el mapa.', true);
  if (!name) return toast('El nombre del lugar es obligatorio.', true);
  if (!authorName) return toast('El nombre del autor es obligatorio.', true);
  if (!imgRealData || !imgIlusData) return toast('Ambas imagenes son requeridas.', true);

  var btn = document.getElementById('btnGuardarLugar');
  btn.innerHTML = 'Guardando en el servidor...';
  btn.disabled = true;

  var place = {
    id: Date.now().toString(),
    name: name,
    lat: selectedCoord.lat,
    lng: selectedCoord.lng,
    realImg: imgRealData,
    ilusImg: imgIlusData
  };

  try {
    var res = await fetch('/api/mapas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: authorName, places: [place], userToken: userToken })
    });
    
    var data = await res.json();
    if (data.success) {
      localStorage.setItem('mapArtLastAuthor', authorName);
      
      // Limpiar formulario
      document.getElementById('pNombre').value = '';
      document.getElementById('pvReal').style.display = 'none';
      document.getElementById('pvReal').src = '';
      document.getElementById('pvIlus').style.display = 'none';
      document.getElementById('pvIlus').src = '';
      document.getElementById('coordInfo').innerHTML = 'Esperando seleccion en el mapa...';
      imgRealData = '';
      imgIlusData = '';
      if (marker) map.removeLayer(marker);
      selectedCoord = null;
      
      toast('Mapa guardado con exito.');
      
      // Actualizar historial en segundo plano
      cargarHistorialMapas();
    } else {
      toast('Error del servidor: ' + (data.error || 'Desconocido'), true);
    }
  } catch (err) {
    console.error(err);
    toast('Error de conexion al guardar el mapa.', true);
  } finally {
    btn.innerHTML = 'Guardar Mapa en Servidor';
    btn.disabled = false;
  }
}


function toast(msg, isErr) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (isErr ? 'err on' : 'on');
  setTimeout(function() { t.classList.remove('on'); }, 3500);
}

async function cargarHistorialMapas() {
  var div = document.getElementById('listaHistorial');
  div.innerHTML = 'Consultando base de datos...';

  try {
    var res = await fetch('/api/mis-mapas/' + userToken);
    var data = await res.json();
    
    if (data.success && data.mapas.length > 0) {
      var html = '';
      for (var i = 0; i < data.mapas.length; i++) {
        var m = data.mapas[i];
        html += '<div style="position:relative; border:1px solid #ccc; padding:12px; border-radius:8px; background:#fff;">';
        var svgTrash = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
        html += '<button onclick="borrarMapaEnServidor(\'' + m.id + '\')" style="position:absolute; top:10px; right:10px; background:transparent; border:none; color:var(--rust); cursor:pointer; padding:5px; border-radius:4px;" onmouseover="this.style.backgroundColor=\'#ffebee\'" onmouseout="this.style.backgroundColor=\'transparent\'" title="Borrar Mapa">' + svgTrash + '</button>';
        html += '<div style="font-weight:bold; font-size:1.1rem; color:var(--ochre); padding-right:35px;">' + (m.placeName || 'Lugar sin nombre') + '</div>';
        html += '<div style="font-size:0.9rem; margin-top:4px;">Ubicacion: <b>Lat ' + m.placeLat.toFixed(4) + ', Lng ' + m.placeLng.toFixed(4) + '</b></div>';
        html += '<div style="font-size:0.9rem; margin-top:4px;">Autor: <b>' + m.author + '</b></div>';
        html += '<div style="font-size:0.8rem; color:#666; margin-top:4px;">Creado: ' + new Date(m.createdAt).toLocaleDateString() + '</div>';
        html += '<div style="display:flex; gap:10px; margin-top:10px;">';
        html += '<a href="viewer.html?id=' + m.id + '" target="_blank" class="btn btn-ochre" style="text-decoration:none; text-align:center; padding:8px; font-size:0.85rem;">Abrir Mapa</a>';
        html += '<button class="btn btn-green" style="padding:8px; font-size:0.85rem;" onclick="mostrarQR(\'' + m.id + '\')">Ver QR</button>';
        html += '</div>';
        html += '</div>';
      }
      div.innerHTML = html;
    } else {
      div.innerHTML = 'Aun no tienes mapas guardados en el servidor.';
    }
  } catch(e) {
    div.innerHTML = 'Error de conexion con el servidor. Verifica que el servidor este activo.';
  }
}

async function borrarMapaEnServidor(id) {
  if (!confirm('¿Estás seguro de que deseas borrar este mapa? Esta acción no se puede deshacer.')) return;
  try {
    var res = await fetch('/api/mapas/' + id, { method: 'DELETE' });
    var data = await res.json();
    if (data.success) {
      toast('Mapa eliminado correctamente.');
      cargarHistorialMapas();
    } else {
      toast('Error al borrar: ' + (data.error || 'Desconocido'), true);
    }
  } catch (e) {
    toast('Error de conexión al borrar el mapa.', true);
  }
}

function mostrarQR(mapId) {
  var urlBase = window.location.origin;
  var finalUrl = urlBase + '/viewer.html?id=' + mapId;
  
  document.getElementById('modalQR').classList.add('on');
  var canvas = document.getElementById('qrCanvas');
  canvas.innerHTML = '';
  
  new QRCode(canvas, {
    text: finalUrl,
    width: 200,
    height: 200,
    colorDark: '#1a1209',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.L
  });
}

// Control del Slider Comparador
var dragOn = false;

function abrirComparador(realSrc, ilusSrc) {
  document.getElementById('sIlus').src = ilusSrc; 
  document.getElementById('sReal').src = realSrc; 
  document.getElementById('modalCmp').classList.add('on');
  setSliderPos(0.5); 
}

function setSliderPos(ratio) {
  var p = Math.min(Math.max(ratio, 0.05), 0.95); 
  var pct = (1 - p) * 100;
  document.getElementById('sReal').style.clipPath = 'inset(0 ' + pct + '% 0 0)';
  document.getElementById('sLine').style.left = (p * 100) + '%';
  document.getElementById('sHandle').style.left = (p * 100) + '%';
}

setTimeout(function() {
  var sliderBox = document.getElementById('sBox');
  if (sliderBox) {
    function moveDrag(e) {
      var rect = sliderBox.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var x = clientX - rect.left;
      setSliderPos(x / rect.width);
    }

    sliderBox.addEventListener('mousedown', function(e) { dragOn = true; moveDrag(e); e.preventDefault(); });
    sliderBox.addEventListener('touchstart', function(e) { dragOn = true; moveDrag(e); }, {passive: false});

    document.addEventListener('mousemove', function(e) { if (dragOn) moveDrag(e); });
    document.addEventListener('touchmove', function(e) { if (dragOn) moveDrag(e); }, {passive: false});

    document.addEventListener('mouseup', function() { dragOn = false; });
    document.addEventListener('touchend', function() { dragOn = false; });
  }
}, 500);
