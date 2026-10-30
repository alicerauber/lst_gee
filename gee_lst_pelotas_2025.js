// 1. Carregar o limite de Pelotas (substitua pelo caminho correto do seu asset)
var pelotas = ee.FeatureCollection('projects/annular-form-401820/assets/Pelotas');
Map.centerObject(pelotas, 11)

// Definindo o período
var startDate = '2024-12-21';
var endDate = '2025-03-31';

var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
           .filterBounds(pelotas)
           .filterDate(startDate, endDate)
           .filter(ee.Filter.lt('CLOUD_COVER', 20)); // Menos de 10% de nuvens
           

// Função para aplicar os fatores de escala (ópticos e termais)
var aplicaFatoresEscala = function(image) {
  // Fatores para as bandas ópticas
  var opticalBands = image.select('SR_B.*').multiply(0.0000275).add(-0.2);
  
  // Fatores para a Banda Termal 10 (converte para Temperatura de Brilho em Kelvin)
  var thermalBands = image.select('ST_B10').multiply(0.00341802).add(149.0);
  
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
};

// Aplicar a função à coleção
var l8Processada = l8.map(aplicaFatoresEscala);

// 2. Calcular a LST simplificada (convertendo a Banda 10 de Kelvin para Celsius: subtraindo 273.15)
var calculaLST = function(image) {
  var lstCelsius = image.select('ST_B10').subtract(273.15).rename('LST');
  return image.addBands(lstCelsius);
};

var l8ComLST = l8Processada.map(calculaLST);

// 3. Fazer a média do período e recortar para Pelotas
var imagemMedia = l8ComLST.median().clip(pelotas);
var lstPelotas = imagemMedia.select('LST');

// 4. Parâmetros de visualização da temperatura (de 20°C a 45°C com paleta térmica)
var lstVisParams = {
  min: 20,
  max: 46,
  palette: [
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6', 
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef', 
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f', 
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff4e08', 'ff0000', 'de0100'
  ]
};

// 5. Adicionar a camada de temperatura ao mapa
Map.addLayer(lstPelotas, lstVisParams, 'LST - Janeiro 2025 (°C)');

print('Cálculo de temperatura concluído para Pelotas!');

// Calcular o valor Mínimo e Máximo da LST dentro do limite de Pelotas
var minMaxLST = lstPelotas.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: pelotas.geometry(),
  scale: 30, // Resolução do Landsat 8 (30 metros)
  maxPixels: 1e9 // Limite de segurança de pixels
});

// Imprimir os resultados no Console
print('Estatísticas de Temperatura (Mínimo e Máximo em °C):', minMaxLST);

// Imprimir o número total de cenas usadas na média
print('Número total de cenas usadas no período:', l8.size());

// Descobrir as datas das cenas utilizadas na coleção
var datasCenas = l8.map(function(imagem) {
  // Pega a propriedade de data do sistema e converte para string legível
  var dataStr = ee.Date(imagem.get('system:time_start')).format('YYYY-MM-dd');
  // Retorna uma feição contendo apenas essa propriedade de data
  return ee.Feature(null, {'Data': dataStr});
});

// Imprimir a lista de datas no Console
print('Datas das cenas Landsat utilizadas:', datasCenas.aggregate_array('Data'));

// --- EXPORTAR LST PARA O GOOGLE DRIVE ---
Export.image.toDrive({
  image: lstPelotas,                     // A imagem de temperatura que você gerou
  description: 'LST_Pelotas_Verao_2025',  // Nome da tarefa e do arquivo inicial
  folder: 'GEE_Exports',                // Nome da pasta que será criada no seu Google Drive (opcional)
  region: pelotas.geometry(),            // O limite do shapefile de Pelotas para recortar a exportação
  scale: 30,                             // Resolução espacial do Landsat 8 em metros
  maxPixels: 1e9                         // Limite máximo de pixels permitidos
});

print('Instrução de exportação enviada! Vá até a aba Tasks para iniciar.');