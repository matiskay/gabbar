'use strict';

const argv = require('minimist')(process.argv.slice(2));
const readline = require('readline');
const fs = require('fs');
const request = require('request');
let queue = require('d3-queue').queue;
const parser = require('real-changesets-parser');

if (!argv.changesets || !argv.url) {
    console.log('');
    console.log('Usage: node download-full-changesets.js OPTIONS');
    console.log('');
    console.log('  OPTIONS');
    console.log('    --changesets       changesets.csv');
    console.log('    --url              "s3://bucket/"');
    console.log('');
    return;
}

function downloadChangeset(changesetID, callback) {
    process.stderr.write(String(changesetID) + '\n');
    let url = argv.url + changesetID + '.json';
    request(url, function (error, response, body) {
        if (error) return callback(error);

        try {
            // Check if the result was a proper JSON.
            var changeset = parser(JSON.parse(body));
            console.log(body);
        } catch(error) {
            // TODO: Temporarily skip when error.
        }

        return callback(null);
    });
}

const q = queue(5);

const rl = readline.createInterface({
    input: fs.createReadStream(argv.changesets),
    outout: process.stdout
});

rl.on('line', (input) => {
    // Format example: 47490533,True
    let parts = input.split(',');
    let changesetID = parts[0];

    // Skip csv header.
    if (!(parseInt(changesetID))) return;
    q.defer(downloadChangeset, changesetID);
});

rl.on('close', () => {
    q.awaitAll(function (error, result) {
        // Nothing to do here.
    });
});
