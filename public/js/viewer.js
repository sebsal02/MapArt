let map;

// Cerrar modales con tecla Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modalCmp = document.getElementById('modalCmp');
    if (modalCmp) modalCmp.classList.remove('on');
    var modalImg = document.getElementById('modalImgFull');
    if (modalImg) modalImg.classList.remove('on');
  }
});

// Reverse geocoding usando Nominatim (OpenStreetMap) — gratuito, sin API key
async function getAddress(lat, lng) {
  try {
    var res = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json&addressdetails=1&accept-language=es', {
      headers: { 'User-Agent': 'MapArt-App/1.0' }
    });
    var data = await res.json();
    if (data && data.address) {
      var a = data.address;
      var parts = [];
      if (a.road) parts.push(a.road);
      if (a.house_number) parts[parts.length - 1] += ' #' + a.house_number;
      if (a.neighbourhood || a.suburb) parts.push(a.neighbourhood || a.suburb);
      if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
      if (a.state) parts.push(a.state);
      return parts.length > 0 ? parts.join(', ') : data.display_name;
    }
    return 'Ubicacion: ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
  } catch (e) {
    return 'Ubicacion: ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
  }
}

window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    document.getElementById('loading').innerHTML = 'Error: Identificador de mapa no detectado.';
    return;
  }

  try {
    const res = await fetch('/api/mapas/' + id);
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      mostrarMapa(data.map);
    } else {
      document.getElementById('loading').innerHTML = 'Error: Mapa no encontrado en los registros.';
    }
  } catch (err) {
    document.getElementById('loading').innerHTML = 'Error de comunicacion con el servidor principal.';
  }
};

async function mostrarMapa(mapData) {
  document.getElementById('authorName').textContent = 'Autor: ' + mapData.author;
  document.title = 'MapArt - ' + mapData.author;

  const places = mapData.places || [];
  
  map = L.map('map').setView(places.length ? [places[0].lat, places[0].lng] : [19.4326, -99.1332], 16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(map);

  const placesDiv = document.getElementById('placesList');
  
  for (var index = 0; index < places.length; index++) {
    var p = places[index];

    var icon = L.divIcon({
      html: '<div style="background:var(--accent,#7c6aff);color:#fff;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #0b0b10;"><span style="transform:rotate(45deg)">' + (index+1) + '</span></div>',
      className: '', iconSize: [30, 30], iconAnchor: [15, 30]
    });
    var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup('<b>' + p.name + '</b>');
    
    // Closure for scroll-to-card on marker click
    (function(placeId) {
      marker.on('click', function() {
        var el = document.getElementById('card-' + placeId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    })(p.id);

    // Get address via reverse geocoding
    var address = await getAddress(p.lat, p.lng);

    var card = document.createElement('div');
    card.className = 'place-card';
    card.id = 'card-' + p.id;

    var descHtml = '';
    if (p.description) {
      descHtml = '<p style="font-size:0.88rem; color:var(--text-secondary); font-style:italic; border-left:2px solid var(--accent); padding-left:12px; margin-bottom:14px;">' + p.description + '</p>';
    }

    var pinSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';

    card.innerHTML =
      '<div class="place-header">' +
      '<div class="place-num">' + (index+1) + '</div>' +
      '<div class="place-title">' + p.name + '</div>' +
      '</div>' +
      '<div class="place-body">' +
      descHtml +
      '<div class="place-address">' + pinSvg + ' ' + address + '</div>' +
      '<button class="compare-btn" onclick="abrirComparador(\'' + p.id + '\')">Activar Comparador de Capas</button>' +
      '<div class="images-row">' +
      '<div class="img-box">' +
      '<img src="' + p.ilusImg + '" onclick="verImagen(this.src)" title="Clic para maximizar">' +
      '<p>Ilustracion</p>' +
      '</div>' +
      '<div class="img-box">' +
      '<img src="' + p.realImg + '" onclick="verImagen(this.src)" title="Clic para maximizar">' +
      '<p>Foto Real</p>' +
      '</div>' +
      '</div>' +
      '</div>';

    placesDiv.appendChild(card);
  }

  // Store places data globally for the comparador
  window._placesData = places;

  if (places.length > 1) {
    const bounds = L.latLngBounds(places.map(function(p) { return [p.lat, p.lng]; }));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }
}

function verImagen(src) {
  if (!src) return;
  document.getElementById('imgFullTarget').src = src;
  document.getElementById('modalImgFull').classList.add('on');
}

let dragOn = false;

function abrirComparador(placeId) {
  // Find the place data
  var place = null;
  if (window._placesData) {
    for (var i = 0; i < window._placesData.length; i++) {
      if (window._placesData[i].id === placeId) {
        place = window._placesData[i];
        break;
      }
    }
  }
  if (!place) return;

  var ilusImg = document.getElementById('sIlus');
  var realImg = document.getElementById('sReal');

  // Load both images and calculate proper dimensions to avoid overlap
  var imgA = new Image();
  var imgB = new Image();

  imgA.onload = function() {
    imgB.onload = function() {
      // Both images loaded — set the slider box to match the aspect ratio
      // Use the smaller aspect ratio so neither image overflows
      var sBox = document.getElementById('sBox');
      var boxWidth = sBox.clientWidth;

      var ratioA = imgA.naturalHeight / imgA.naturalWidth;
      var ratioB = imgB.naturalHeight / imgB.naturalWidth;

      // Use the LARGER ratio (taller image) to set the container height
      // This ensures both images fit with object-fit:contain without overlapping
      var maxRatio = Math.max(ratioA, ratioB);
      var containerHeight = boxWidth * maxRatio;

      // Cap to viewport height minus some padding
      var maxH = window.innerHeight * 0.72;
      if (containerHeight > maxH) containerHeight = maxH;

      sBox.style.height = containerHeight + 'px';

      ilusImg.src = place.ilusImg;
      realImg.src = place.realImg;

      document.getElementById('modalCmp').classList.add('on');
      // Start showing the full illustration (slider at far left)
      setSliderPos(0.05);
    };
    imgB.src = place.realImg;
  };
  imgA.src = place.ilusImg;
}

function setSliderPos(ratio) {
  const p = Math.min(Math.max(ratio, 0.05), 0.95); 
  document.getElementById('sReal').style.clipPath = 'inset(0 ' + ((1-p)*100) + '% 0 0)';
  document.getElementById('sLine').style.left = (p*100) + '%';
  document.getElementById('sHandle').style.left = (p*100) + '%';
}

const sliderBox = document.getElementById('sBox');
if(sliderBox) {
  function moveDrag(e) {
    const rect = sliderBox.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setSliderPos(x / rect.width);
  }

  sliderBox.addEventListener('mousedown', (e) => { dragOn = true; moveDrag(e); e.preventDefault(); });
  sliderBox.addEventListener('touchstart', (e) => { dragOn = true; moveDrag(e); }, {passive:false});

  document.addEventListener('mousemove', (e) => { if(dragOn) moveDrag(e); });
  document.addEventListener('touchmove', (e) => { if(dragOn) moveDrag(e); }, {passive:false});

  document.addEventListener('mouseup', () => dragOn = false);
  document.addEventListener('touchend', () => dragOn = false);
}
