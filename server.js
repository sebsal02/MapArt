var express = require('express');
var cors = require('cors');
var path = require('path');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');
var MongoClient = require('mongodb').MongoClient;

var app = express();
var PORT = process.env.PORT || 3000;
var MONGO_URI = process.env.MONGO_URI || null;

var mapsCollection = null;

// Almacen en memoria como respaldo cuando no hay MongoDB
var memoryStore = {};

// Conectar a MongoDB Atlas (base de datos permanente en la nube)
async function initDB() {
  if (!MONGO_URI) {
    console.log('AVISO: MONGO_URI no configurado. Usando almacenamiento en memoria (los datos se pierden al reiniciar).');
    return;
  }
  try {
    var client = new MongoClient(MONGO_URI);
    await client.connect();
    var db = client.db('artmap');
    mapsCollection = db.collection('maps');
    console.log('Conectado a MongoDB Atlas correctamente. Los datos son permanentes.');
  } catch(err) {
    console.error('Error conectando a MongoDB:', err.message);
    console.log('Usando almacenamiento en memoria como respaldo.');
  }
}

// Funciones de acceso a datos (funcionan con MongoDB o memoria)
async function saveMap(mapId, mapData) {
  if (mapsCollection) {
    mapData.mapId = mapId;
    await mapsCollection.insertOne(mapData);
  } else {
    memoryStore[mapId] = mapData;
  }
}

async function getMap(mapId) {
  if (mapsCollection) {
    return await mapsCollection.findOne({ mapId: mapId });
  } else {
    return memoryStore[mapId] || null;
  }
}

async function getMapsByToken(token) {
  if (mapsCollection) {
    return await mapsCollection.find({ ownerToken: token }).toArray();
  } else {
    var results = [];
    for (var key in memoryStore) {
      if (memoryStore[key].ownerToken === token) {
        var copy = JSON.parse(JSON.stringify(memoryStore[key]));
        copy.mapId = key;
        results.push(copy);
      }
    }
    return results;
  }
}

async function deleteAllMaps() {
  if (mapsCollection) {
    await mapsCollection.deleteMany({});
  } else {
    memoryStore = {};
  }
}

// Configuracion del servidor
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false
}));

var apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Demasiadas solicitudes. Intente mas tarde.' }
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Validacion
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isValidBase64Image(str) {
  if (typeof str !== 'string') return false;
  return str.startsWith('data:image/') && str.length < 50000000;
}

// API: Crear mapa
app.post('/api/mapas', async function(req, res) {
  try {
    var body = req.body;
    var author = body.author;
    var places = body.places;
    var userToken = body.userToken;

    if (!userToken || typeof userToken !== 'string') {
      return res.status(401).json({ success: false, error: 'Token de acceso requerido' });
    }
    if (!author || typeof author !== 'string') {
      return res.status(400).json({ success: false, error: 'Autor invalido' });
    }
    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ success: false, error: 'Se requiere al menos un lugar' });
    }

    var cleanPlaces = [];
    for (var i = 0; i < places.length; i++) {
      var p = places[i];
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') {
        return res.status(400).json({ success: false, error: 'Coordenadas invalidas' });
      }
      if (!isValidBase64Image(p.realImg) || !isValidBase64Image(p.ilusImg)) {
        return res.status(400).json({ success: false, error: 'Imagen invalida o muy pesada' });
      }
      cleanPlaces.push({
        id: sanitizeString(String(p.id)),
        name: sanitizeString(p.name),
        lat: p.lat,
        lng: p.lng,
        realImg: p.realImg,
        ilusImg: p.ilusImg
      });
    }

    var mapId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

    var mapData = {
      author: sanitizeString(author),
      ownerToken: sanitizeString(userToken),
      places: cleanPlaces,
      createdAt: new Date().toISOString()
    };

    await saveMap(mapId, mapData);
    console.log('Mapa guardado con ID:', mapId, '- Lugares:', cleanPlaces.length);
    res.json({ success: true, mapId: mapId });
  } catch (error) {
    console.error('Error al crear mapa:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// API: Obtener mapas por token de usuario
app.get('/api/mis-mapas/:token', async function(req, res) {
  try {
    var token = sanitizeString(req.params.token);
    var maps = await getMapsByToken(token);
    var userMaps = [];

    for (var i = 0; i < maps.length; i++) {
      var m = maps[i];
      userMaps.push({
        id: m.mapId,
        author: m.author,
        createdAt: m.createdAt,
        placeName: m.places && m.places.length > 0 ? m.places[0].name : 'Lugar sin nombre',
        placeLat: m.places && m.places.length > 0 ? m.places[0].lat : 0,
        placeLng: m.places && m.places.length > 0 ? m.places[0].lng : 0,
        placesCount: m.places ? m.places.length : 0
      });
    }

    res.json({ success: true, mapas: userMaps });
  } catch (error) {
    console.error('Error al consultar mapas:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// API: Obtener un mapa especifico (para el visor del profesor)
app.get('/api/mapas/:id', async function(req, res) {
  try {
    var mapId = sanitizeString(req.params.id);
    var mapDoc = await getMap(mapId);
    
    if (mapDoc) {
      var safeMap = {
        author: mapDoc.author,
        places: mapDoc.places,
        createdAt: mapDoc.createdAt
      };
      res.json({ success: true, map: safeMap });
    } else {
      res.status(404).json({ success: false, error: 'Mapa no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener mapa:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// API: Borrar todos los mapas de prueba
app.delete('/api/mapas/limpiar', async function(req, res) {
  try {
    await deleteAllMaps();
    console.log('Todos los mapas han sido eliminados.');
    res.json({ success: true, message: 'Todos los mapas eliminados' });
  } catch (error) {
    console.error('Error al limpiar:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// API: Borrar un mapa especifico
app.delete('/api/mapas/:id', async function(req, res) {
  try {
    var mapId = sanitizeString(req.params.id);
    if (mapsCollection) {
      var result = await mapsCollection.deleteOne({ mapId: mapId });
      if (result.deletedCount === 1) {
        res.json({ success: true, message: 'Mapa eliminado' });
      } else {
        res.status(404).json({ success: false, error: 'Mapa no encontrado' });
      }
    } else {
      if (memoryStore[mapId]) {
        delete memoryStore[mapId];
        res.json({ success: true, message: 'Mapa eliminado' });
      } else {
        res.status(404).json({ success: false, error: 'Mapa no encontrado' });
      }
    }
  } catch (error) {
    console.error('Error al borrar mapa:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// API: Diagnostico del servidor
app.get('/api/status', function(req, res) {
  res.json({
    success: true,
    database: mapsCollection ? 'MongoDB Atlas (permanente)' : 'Memoria (temporal)',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor despues de conectar a la base de datos
initDB().then(function() {
  app.listen(PORT, function() {
    console.log('Servidor MapArt iniciado en puerto ' + PORT);
    if (mapsCollection) {
      console.log('Base de datos: MongoDB Atlas (PERMANENTE - los datos nunca se pierden)');
    } else {
      console.log('Base de datos: Memoria RAM (TEMPORAL - configure MONGO_URI para persistencia)');
    }
  });
}).catch(function(err) {
  console.error('Error fatal:', err);
  process.exit(1);
});
