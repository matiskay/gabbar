'use strict';

/*
 * Takes a real changeset from osm-adiff-parser and extract's features to use for machine learning.
 */

const argv = require('minimist')(process.argv.slice(2));
const readline = require('readline');
const fs = require('fs');
const request = require('request');
let queue = require('d3-queue').queue;
const csv = require('csv');
const path = require('path');
const parser = require('real-changesets-parser');

if (!argv.changesets) {
    console.log('');
    console.log('Usage: node extract-features.js OPTIONS');
    console.log('');
    console.log('  OPTIONS');
    console.log('    --changesets       changesets.json');
    console.log('');
    return;
}

var header;
function printFeatures(features, callback) {
    var columns = [
        'changeset_id',
        'harmful',
        'features_created',
        'features_modified',
        'features_deleted'
    ];
    if (!header) {
        console.log(columns.join(','));
        header = columns;
    }

    var row = [];
    for (var i = 0; i < columns.length; i++) {
        row.push(features[columns[i]]);
    }

    csv.stringify([row], function (error, rowAsString) {
        if (error) return callback(error);
        process.stdout.write(rowAsString);
        return callback();  // Nothing to return.
    });
}

function getNewAndOldVersion(changeset, touchedFeature) {
    var result =  {
        'newVersion': {},
        'oldVersion': {}
    };
    var versions = [];
    for (var i = 0; i < changeset.features.length; i++) {
        var feature = changeset.features[i];
        if (feature.properties.id === touchedFeature.properties.id) versions.push(feature);
    }
    if (versions[0].properties.version > versions[1].properties.version) {
        result['newVersion'] = versions[0];
        result['oldVersion'] = versions[1];
    } else {
        result['newVersion'] = versions[1];
        result['oldVersion'] = versions[0];
    }
    return result;
}

function getFeaturesCreated(changeset) {
    var created = [];
    var features = changeset.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        if (feature.properties.action === 'create') created.push(feature);
    }
    return created;
}

function getFeaturesModified(changeset) {
    var modified = [];
    var seenFeatures = [];

    var features = changeset.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var featureID = feature.properties.id;

        if ((feature.properties.action === 'modify') && (seenFeatures.indexOf(featureID) === -1)) {
            modified.push(getNewAndOldVersion(changeset, feature));
            seenFeatures.push(featureID);
        }
    }
    return modified;
}

function getFeaturesDeleted(changeset) {
    var deleted = [];
    var seenFeatures = [];

    var features = changeset.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var featureID = feature.properties.id;

        if ((feature.properties.action === 'delete') && (seenFeatures.indexOf(featureID) === -1)) {
            deleted.push(getNewAndOldVersion(changeset, feature));
            seenFeatures.push(featureID);
        }
    }
    return deleted;
}

function isHarmful(changesetID) {
    for (var i = 0; i < changesetsFromOsmcha.length; i++) {
        var row = changesetsFromOsmcha[i];
        if (row[0] === changesetID) return row[1];
    }
}

var changesetsFromOsmcha = [];
function getChangesetsFromOsmcha(callback) {
    csv.parse(fs.readFileSync(path.join(__dirname, 'full-changeset-ids.csv')), function (error, rows) {
        if (error) return callback(error);

        changesetsFromOsmcha = rows;
        return callback();
    });
}

function extractFeatures(realChangeset, callback) {
    var changeset = parser(realChangeset);

    // console.log(JSON.stringify(changeset));
    // console.log(JSON.stringify(getFeaturesModified(changeset)));

    var changesetID = realChangeset['metadata']['id']

    var features = {
        'changeset_id': changesetID,
        'harmful': isHarmful(changesetID),
        'features_created': getFeaturesCreated(changeset).length,
        'features_modified': getFeaturesModified(changeset).length,
        'features_deleted': getFeaturesDeleted(changeset).length,
    };
    printFeatures(features, function (error, result) {
        return callback();  // Nothing to return.
    });
}

const q = queue(1);
q.defer(getChangesetsFromOsmcha);

const rl = readline.createInterface({
    input: fs.createReadStream(argv.changesets),
    outout: process.stdout
});

rl.on('line', (line) => {
    q.defer(extractFeatures, JSON.parse(line));
});

rl.on('close', () => {
    q.awaitAll(function (error, result) {
        if (error) throw error;
        // Nothing to do here.
    });
});
