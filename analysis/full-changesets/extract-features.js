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
var turf = require('@turf/turf');

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
 * Return details of OSM mapper using osm-comments-api.
 * @param {string} userID ID of mapper on OSM.
 * @returns {Object} Details of user as JSON.
 */
function getUserDetails(userID) {
    return new Promise((resolve, reject) => {
        let filename = path.join(__dirname, 'users/' + userID + '.json');

        // If file exists locally, use it.
        if(fs.existsSync(filename)) return resolve(JSON.parse(fs.readFileSync(filename)));

        let url = 'https://osm-comments-api.mapbox.com/api/v1/users/id/' + userID;
        request(url, (error, response, body) => {
            if (error || response.statusCode !== 200) resolve({});
            fs.writeFileSync(filename, body);
            resolve(JSON.parse(body));
        });
    });
}

/**
 * Returns area of bbox.
 * @param {Object} bbox Array representing bbox in [minX, minY, maxX, maxY] order.
 * @returns {number} Area of changeset bbox in square kilometers.
 */
function getBBOXArea(bbox) {
    var polygon = turf.bboxPolygon(bbox);
    return turf.area(polygon);
}

/**
 * Return bbox of changeset.
 * @param {Object} changeset Geojson representation of changeset.
 * @returns {Object} Array representing bbox in [minX, minY, maxX, maxY] order.
 */
function getChangesetBBOX(changeset) {
    let meta = changeset['metadata'];
    return [meta['min_lat'], meta['min_lon'], meta['max_lat'], meta['max_lon']].map(parseFloat);
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
    var userID = realChangeset['metadata']['uid'];

    var header = [
        'changeset_id',
        'harmful',
        'features_created',
        'features_modified',
        'features_deleted',
        'user_id',
        'user_name',
        'user_changesets',
        'user_features',
        'changeset_bbox_area'
    ];
    if (!headerPrinted) {
        console.log(header.join(','));
        headerPrinted = true;
    }

    let q = [
        getUserDetails(userID)
    ];
    Promise.all(q).then(results => {
        let userDetails = results[0];
        let features = [
            changesetID,
            isHarmful(changesetID, osmchaChangesets),
            getFeaturesCreated(changeset).length,
            getFeaturesModified(changeset).length,
            getFeaturesDeleted(changeset).length,
            userID,
            realChangeset['metadata']['user'],
            userDetails['changeset_count'],
            userDetails['num_changes'],
            getBBOXArea(getChangesetBBOX(realChangeset)),
        ];

        csv.stringify([features], (error, resultsAsString) => {
            if (error) throw error;
            process.stdout.write(resultsAsString);
            callback();
        });
    })
    .catch(error => {
        throw error;
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
        var q = queue(5);
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
