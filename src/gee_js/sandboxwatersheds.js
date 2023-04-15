var palettes = require('users/gena/packages:palettes');
////////////////////////////////////////////////////////////////////////////////////////////////////
// BEGIN: USER-DEFINED PARAMETERS AND DATA
////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////
  // 1. DEFINE DATA TO CALC CONSTRAINTS IN BOUNDS
  // CAN USE A GEE DATA SOURCE
  // .. OR UPLOAD CUSTOM DATA SOURCE:
  // ... https://developers.google.com/earth-engine/guides/table_upload
  //////////////////////////////////////////////////
    var ft_list = ee.List([
      'Arapaho and Roosevelt National Forests'
      // , 'Grand Mesa, Uncompahgre and Gunnison National Forests'
      // , 'Pike and San Isabel National Forests'
      // , 'Rio Grande National Forest'
      // , 'San Juan National Forest'
      , 'White River National Forest'
      // '02'
      // 'Colorado','New Mexico','Arizona','Utah'
    ]);
    var my_feature_collection = 
    ///////////////// states
      // ee.FeatureCollection("TIGER/2018/States")
      //   .filter(ee.Filter.inList('STUSPS', ft_list))
    ///////////////// usfs forests
      ee.FeatureCollection("users/GeorgeWoolsey/L48_USFS_NatlForests")
        .filter(ee.Filter.inList('COMMONNAME', ft_list))
        // .filter(ee.Filter.inList('REGION', ft_list))
    ///////////////// wildfire priority landscapes
    //   ee.FeatureCollection("projects/forestmgmtconstraint/assets/Wildfire_Crisis_Strategy_Landscapes")
    //   .filter(ee.Filter.inList('STATE', ft_list))
    // ;
    // var my_feature_collection = ex_polygon
      // .map(function(feature){
      //   return feature
      //     .buffer(10000, 100)
      //   ;
      // })
    // ;
    print(my_feature_collection.aggregate_array('COMMONNAME'), 'FORESTS TO DO' );
    
//////////////////////////////////////////////////////
// HUC-12 subwatershed
//////////////////////////////////////////////////////
var huc12 = ee.FeatureCollection("USGS/WBD/2017/HUC12")
  .filterBounds(my_feature_collection)
  .map(function(my_feature){
    var huc12_area_m2 = ee.Number(my_feature.geometry().area());
    return my_feature.set('huc12_area_m2', huc12_area_m2);
  })
;
print(huc12.first(),'huc12');
print(huc12.size(),'huc12.size');


///////////////////////////////////////
// intersect with big feature
///////////////////////////////////////
// var mapped = vectors.map(function(feat1){
//   feat1 = ee.Feature(feat1);
//   var mapped1 = polygons.map(function(feat2){
//     feat2 = ee.Feature(feat2);
//     var intersection = feat2.intersection(feat1, ee.ErrorMargin(1));
//     return intersection
//   }, true) // Note the boolean flag.  See map() docs for details.
//   return mapped1
// }).flatten();

// // Now set properties on non-null features.
// mapped = mapped.map(function(intersection) {
//   return intersection.set({
//     'Intersect': intersection.area().divide(1000 * 1000),
//     'date': '2016-01-01'})
// });

var big_feature = my_feature_collection.first();
var huc12_intersection = huc12
  .map(function(small_feature){
    var ft_intrsct = small_feature.intersection({'right': big_feature}); // , 'maxError': 1
    var huc12_intrsct_area_m2 = ee.Number(ft_intrsct.geometry().area());
    var huc12_area_m2 = ee.Number(small_feature.get('huc12_area_m2'));
    return ft_intrsct
      .set({
        'huc12_intrsct_area_m2': huc12_intrsct_area_m2
        , 'pct_huc12_intrsct': huc12_intrsct_area_m2.divide(huc12_area_m2)
      }) 
      .copyProperties(big_feature)
    ;
  }, true) // true on map returns non-null features
  .filter(ee.Filter.gte('pct_huc12_intrsct', ee.Number(0.25)))
;
print(huc12_intersection.first(),'huc12_intersection');

// null geometry so csv can be exported
var huc12_intersection_csv = huc12_intersection.map(function(ft){
  var nullfeat = ee.Feature(null);
  return nullfeat.copyProperties(ft);
});
// export
  Export.table.toDrive({
    collection: huc12_intersection_csv,
    folder: 'GEE_output',
    description: 'watershed_test',
    fileFormat: 'CSV'
  });

////////////////////////////////////////
// MAPPING
////////////////////////////////////////
// Create an empty image into which to paint the features, cast to byte.
var empty = ee.Image().byte();

// Paint all the polygon edges with the same number and width, display.
var outline = empty.paint({
  featureCollection: my_feature_collection,
  color: 'CNID',
  width: 3
});
// var palette = palettes.matplotlib.viridis[2];
var palette = palettes.matplotlib.viridis[7];
print(palette, 'palette');
var min_val = my_feature_collection.aggregate_array('CNID').reduce('min');
var max_val = my_feature_collection.aggregate_array('CNID').reduce('max');
print(min_val, 'min');
print(max_val, 'max');
//////////////////////////////////////////////////////////
Map.centerObject(my_feature_collection, 10);
// Map.addLayer(outline, {palette: 'FF0000'}, 'edges');
Map.addLayer(huc12, {color:'gray'}, 'huc12',0, 0.5);
Map.addLayer(huc12_intersection, {color:'red'}, 'huc12_intersection',1, 0.5);

Map.addLayer(outline, {min:68, max:164, palette:palette}, 'forests', 1);
// var treatViz = {min: 0, max: 1, palette: ['B03A2E','4A235A']};
// Map.addLayer(image_of_classified, treatViz, 'image_of_classified', 1, 0.8);
// var display = ee.Image(0).updateMask(0).paint(vectors_of_classified,'000000',1);
// Map.addLayer(display, {palette:'000000'}, 'vectors_of_classified', 1);


