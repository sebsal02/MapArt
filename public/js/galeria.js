window.onload = async function () {
  try {
    var res = await fetch('/api/todos-los-mapas');
    var data = await res.json();

    document.getElementById('loading').style.display = 'none';

    if (data.success && data.mapas.length > 0) {
      var grid = document.getElementById('galeriaGrid');
      grid.style.display = 'grid';

      for (var i = 0; i < data.mapas.length; i++) {
        var m = data.mapas[i];
        var card = document.createElement('div');
        card.className = 'galeria-card';
        // Staggered animation delay for each card
        card.style.animationDelay = (i * 0.08) + 's';

        var descHtml = '';
        if (m.placeDescription) {
          descHtml = '<div class="galeria-card-desc">' + m.placeDescription + '</div>';
        }

        var imgHtml = '';
        if (m.placeImg) {
          imgHtml = '<img src="' + m.placeImg + '" class="galeria-card-img" alt="Preview" loading="lazy">';
        }

        card.innerHTML =
          imgHtml +
          '<div class="galeria-card-body">' +
          '<div class="galeria-card-name">' + (m.placeName || 'Lugar sin nombre') + '</div>' +
          descHtml +
          '<div class="galeria-card-meta">' +
          'Autor: <b>' + m.author + '</b><br>' +
          'Creado: ' + new Date(m.createdAt).toLocaleDateString() +
          '</div>' +
          '</div>' +
          '<div class="galeria-card-action">' +
          '<a href="viewer.html?id=' + m.id + '">Ver Mapa Comparativo</a>' +
          '</div>';

        grid.appendChild(card);
      }
    } else {
      document.getElementById('galeriaGrid').style.display = 'none';
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<h2>No hay mapas todavia</h2><p>Los alumnos aun no han creado mapas.</p>';
      document.body.appendChild(empty);
    }
  } catch (e) {
    document.getElementById('loading').innerHTML = '<div style="color:var(--danger);">Error de conexion con el servidor.</div>';
  }
};
