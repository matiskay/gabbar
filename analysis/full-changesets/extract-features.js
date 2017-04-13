'use strict';

/*
 * Takes a real changeset from osm-adiff-parser and extract's features to use for machine learning.
 */

const argv = require('minimist')(process.argv.slice(2));
const readline = require('readline');
const fs = require('fs');
const request = require('request');
const csv = require('csv');
const path = require('path');
const parser = require('real-changesets-parser');
let queue = require('d3-queue').queue;

if (!argv.changesets) {
    console.log('');
    console.log('Usage: node extract-features.js OPTIONS');
    console.log('');
    console.log('  OPTIONS');
    console.log('    --changesets       changesets.json');
    console.log('');
    return;
}

// To track of csv header was printed or not.
var headerPrinted = false;

/**
 * Return if changeset is harmful or not using dump from osmcha.
 * @param {string} changesetID ID of the changeset.
 * @param {Object} osmchaChangesets Array of changesets from osmcha.
 * @returns {boolean} Is the changeset harmful or not.
 */
function isHarmful(changesetID, osmchaChangesets) {
    for (var osmchaChangeset of osmchaChangesets) {
        if (osmchaChangeset[0] === changesetID) return osmchaChangeset[1];
    }
}

/**
 * Return features created in the changeset.
 * @param {Object} changeset Geojson representation of changeset.
 * @returns {Object} Array of array with just the new feature as `[[newVersion], ...]`.
 */
function getFeaturesCreated(changeset) {
    let created = [];
    for (var feature of changeset.features) {
        if (feature.properties.action === 'create') created.push(feature);
    }
    return created;
}

/**
 * Return features modified in the changeset.
 * @param {Object} changeset Geojson representation of changeset.
 * @returns {Object} Array of array with new and old version of feature as `[[newVersion, oldVersion], ...]`.
 */
function getFeaturesModified(changeset) {
    let modified = [];
    let seenFeatures = [];
    for (var feature of changeset.features) {
        let featureID = feature.properties.id;
        if ((feature.properties.action === 'modify') && (seenFeatures.indexOf(featureID) === -1)) {
            modified.push(getNewAndOldVersion(changeset, feature));
            seenFeatures.push(featureID);
        }
    }
    return modified;
}

/**
 * Return features deleted in the changeset.
 * @param {Object} changeset Geojson representation of changeset.
 * @returns {Object} Array of array with new and old version of feature as `[[newVersion, oldVersion], ...]`.
 */
function getFeaturesDeleted(changeset) {
    let deleted = [];
    let seenFeatures = [];
    for (var feature of changeset.features) {
        var featureID = feature.properties.id;
        if ((feature.properties.action === 'delete') && (seenFeatures.indexOf(featureID) === -1)) {
            deleted.push(getNewAndOldVersion(changeset, feature));
            seenFeatures.push(featureID);
        }
    }
    return deleted;
}

/**
 * Return new and old version of a feature from the changeset.
 * @param {Object} changeset Geojson representation of changeset.
 * @param {Object} touchedFeature Geojson representation of feature who's new and old versions is to be returned.
 * @returns {Object} Array of new and old version of feature as `[newVersion, oldVersion]`.
 */
function getNewAndOldVersion(changeset, touchedFeature) {
    var versions = [];
    for (var feature of changeset.features) {
        if (feature.properties.id === touchedFeature.properties.id) versions.push(feature);
    }
    if (versions[0].properties.version > versions[1].properties.version) return [versions[0], versions[1]];
    else return [versions[1], versions[0]];
}

/**
 * Print features of changeset to use for machine learning.
 * @param {Object} realChangeset JSON version of changeset.
 * @param {Object} osmchaChangesets Array of changesets downloaded from osmcha.
 * @param {Object} callback Function to call once done.
 */
function extractFeatures(realChangeset, osmchaChangesets, callback) {
    var changeset = parser(realChangeset);
    var changesetID = realChangeset['metadata']['id'];

    var header = [
        'changeset_id',
        'harmful',
        'features_created',
        'features_modified',
        'features_deleted'
    ];
    if (!headerPrinted) {
        console.log(header.join(','));
        headerPrinted = true;
    }

    var features = [
        changesetID,
        isHarmful(changesetID, osmchaChangesets),
        getFeaturesCreated(changeset).length,
        getFeaturesModified(changeset).length,
        getFeaturesDeleted(changeset).length
    ];

    csv.stringify([features], (error, resultsAsString) => {
        if (error) throw error;
        process.stdout.write(resultsAsString);
        callback();
    });
}

/**
 * Get list of changesets from osmcha.
 * @returns {Object} Array of changesets from osmcha.
 */
function getOsmchaChangesets() {
    return new Promise((resolve, reject) => {
        var file = fs.readFileSync(path.join(__dirname, 'full-changeset-ids.csv'));
        csv.parse(file, (error, rows) => {
            if (error) return reject(error);
            resolve(rows);
        });
    });
}

function main() {
    getOsmchaChangesets()
    .then(osmchaChangesets => {
        var q = queue(1);
        const reader = readline.createInterface({
            input: fs.createReadStream(argv.changesets),
        });
        reader.on('line', (line) => q.defer(extractFeatures, JSON.parse(line), osmchaChangesets));
        reader.on('close', () => {
            q.awaitAll((error, results) => {
                if (error) throw error;
            });
        });
    });
}

main()