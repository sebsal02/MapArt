let map, marker, selectedCoord = null;
let places = [];
let imgRealData = '', imgIlusData = '';

// Sistema de Token Unico e Intransferible por dispositivo
function getOrGenerateToken() {
  let token = localStorage.getItem('mapArtUserToken');
  if (!token) {
    token = 'usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2);
    localStorage.setItem('mapArtUserToken', token);
  }
  return token;
}
const userToken = getOrGenerateToken();

window.onload = () => {
  // Cargar borrador local si existe
  const draft = localStorage.getItem('mapArtDraftPlaces');
  if (draft) {
    try {
      places = JSON.parse(draft);
    } catch(e) {
      places = [];
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

  if (places.length > 0) {
    dibujarMarcadoresGuardados();
  }
};

function cambiarTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  
  var tabBtn = document.querySelector('.tab[onclick="cambiarTab(\'' + tab + '\')"]');
  var tabPanel = document.getElementById('tab-' + tab);
  
  if (tabBtn) tabBtn.classList.add('on');
  if (tabPanel) tabPanel.classList.add('on');
  
  if (tab === 'historial') {
    cargarHistorialMapas();
  }
}

function resizeImage(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var w = img.width;
      var h = img.height;
      var MAX = 500; 

      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewImg(e, prevId) {
  var file = e.target.files[0];
  if (!file) return;
  resizeImage(file, function(dataUrl) {
    var img = document.getElementById(prevId);
    img.src = dataUrl;
    img.style.display = 'block';
    if (prevId === 'pvReal') imgRealData = dataUrl;
    if (prevId === 'pvIlus') imgIlusData = dataUrl;
    // Limpiar el input para permitir resubir
    e.target.value = '';
  });
}

function verImagen(src) {
  if (!src) return;
  document.getElementById('imgFullTarget').src = src;
  document.getElementById('modalImgFull').classList.add('on');
}

function agregarLugar() {
  var name = document.getElementById('pNombre').value.trim();
  if (!selectedCoord) return toast('Seleccione un lugar en el mapa.', true);
  if (!name) return toast('El nombre del lugar es obligatorio.', true);
  if (!imgRealData || !imgIlusData) return toast('Ambas imagenes son requeridas.', true);

  var place = {
    id: Date.now().toString(),
    name: name,
    lat: selectedCoord.lat,
    lng: selectedCoord.lng,
    realImg: imgRealData,
    ilusImg: imgIlusData
  };

  places.push(place);
  guardarBorrador();
  
  L.marker([place.lat, place.lng]).addTo(map).bindPopup('<b>' + place.name + '</b>');
  
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
  
  toast('Lugar registrado con exito. Total: ' + places.length);
}

function guardarBorrador() {
  try {
    localStorage.setItem('mapArtDraftPlaces', JSON.stringify(places));
  } catch(e) {
    toast('Advertencia: No se pudo guardar el borrador local.', true);
  }
}

function dibujarMarcadoresGuardados() {
  map.eachLayer(function(layer) {
    if (layer instanceof L.Marker) { map.removeLayer(layer); }
  });
  places.forEach(function(p) {
    L.marker([p.lat, p.lng]).addTo(map).bindPopup('<b>' + p.name + '</b>');
  });
}

function borrarLugar(id) {
  places = places.filter(function(p) { return p.id !== id; });
  guardarBorrador();
  dibujarMarcadoresGuardados();
  toast('Lugar eliminado.');
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
        html += '<div style="border:1px solid #ccc; padding:12px; border-radius:8px; background:#fff;">';
        html += '<div style="font-weight:bold;">Autor: ' + m.author + '</div>';
        html += '<div style="font-size:0.8rem; color:#666;">Lugares: ' + m.placesCount + ' | Creado: ' + new Date(m.createdAt).toLocaleDateString() + '</div>';
        html += '<a href="viewer.html?id=' + m.id + '" target="_blank" style="display:inline-block; margin-top:8px; color:var(--ochre); font-weight:bold; text-decoration:none;">Abrir Mapa</a>';
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

async function generarQR() {
  var authorName = document.getElementById('alumnoNombre').value.trim();
  if (places.length === 0) return toast('Agregue lugares al mapa antes de continuar.', true);
  if (!authorName) return toast('El nombre del autor es obligatorio.', true);

  var btn = document.getElementById('btnGenerar');
  btn.innerHTML = 'Procesando datos seguros...';
  btn.disabled = true;

  try {
    var res = await fetch('/api/mapas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: authorName, places: places, userToken: userToken })
    });
    
    var data = await res.json();
    if (data.success) {
      var urlBase = window.location.origin;
      var finalUrl = urlBase + '/viewer.html?id=' + data.mapId;
      
      document.getElementById('qrResult').style.display = 'block';
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

      var link = document.getElementById('qrLink');
      link.href = finalUrl;
      link.textContent = finalUrl;
      
      toast('Mapa guardado con exito. QR generado.');
    } else {
      toast('Error del servidor: ' + (data.error || 'Desconocido'), true);
    }
  } catch (err) {
    console.error(err);
    toast('Error de conexion. Verifique que el servidor esta activo.', true);
  } finally {
    btn.innerHTML = 'Guardar en Servidor y Generar QR';
    btn.disabled = false;
  }
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
