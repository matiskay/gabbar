module.exports = function (tileLayers, tile, writeData, done) {
    var osm = tileLayers.osm.osm;

    var primaryTags = [
        'aerialway', 'aeroway', 'amenity', 'barrier', 'boundary', 'building', 'craft',
        'emergency', 'geological', 'highway', 'historic', 'landuse', 'leisure', 'man_made',
        'military', 'natural', 'office', 'place', 'power', 'public_transport', 'railway',
        'route', 'shop', 'sport', 'tourism', 'waterway'
    ];

    var results = [];
    for (var i = 0; i < osm.features.length; i++) {
        var feature = osm.features[i];

        // For every property of the feature.
        Object.keys(feature.properties).map(function (property) {
            // The property as is, is not a primary tag but when lower cased is one.
            if ((primaryTags.indexOf(property) === -1) && primaryTags.indexOf(property.toLowerCase()) !== -1) {
                results.push(JSON.stringify(feature));
            }
        });
    }

    if (results.length > 0) console.log('\n' + results.join('\n'));
    done(null, null);
};
