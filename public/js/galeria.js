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
          '<a href="viewer.html?id=' + m.id + '" class="btn-view">Ver Mapa Comparativo</a>' +
          '<button class="btn-delete" onclick="eliminarMapa(\'' + m.id + '\', this)" title="Eliminar Mapa">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>' +
          'Eliminar</button>' +
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

window.eliminarMapa = async function (id, btn) {
  if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este mapa de la galería?')) {
    return;
  }
  
  var card = btn.closest('.galeria-card');
  if (card) {
    card.style.pointerEvents = 'none';
    card.style.opacity = '0.5';
  }

  try {
    var res = await fetch('/api/mapas/' + id, { method: 'DELETE' });
    var data = await res.json();
    if (data.success) {
      if (card) {
        card.style.transition = 'all 0.4s ease';
        card.style.transform = 'scale(0.8) translateY(20px)';
        card.style.opacity = '0';
        setTimeout(function() {
          card.remove();
          var grid = document.getElementById('galeriaGrid');
          if (grid && grid.children.length === 0) {
            grid.style.display = 'none';
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<h2>No hay mapas todavia</h2><p>Los alumnos aun no han creado mapas.</p>';
            document.body.appendChild(empty);
          }
        }, 400);
      }
    } else {
      alert('Error al eliminar: ' + (data.error || 'No se pudo eliminar'));
      if (card) {
        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
      }
    }
  } catch (err) {
    alert('Error de conexión al intentar eliminar el mapa.');
    if (card) {
      card.style.pointerEvents = 'auto';
      card.style.opacity = '1';
    }
  }
};
