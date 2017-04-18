'use strict';

const argv = require('minimist')(process.argv.slice(2), {string: ['harmful', 'notHarmful', 'startRow']});
const csv = require('csv');
const path = require('path');
const fs = require('fs');

if (!argv.changesets || !argv.harmful || !argv.notHarmful || !argv.startRow) {
    console.log('');
    console.log('Usage: node filter-changesets.js OPTIONS');
    console.log('');
    console.log('  OPTIONS');
    console.log('    --changesets   changesets.csv');
    console.log('    --harmful      20');
    console.log('    --notHarmful   5');
    console.log('    --startRow     0');
    console.log('');
    return;
}

let harmfulCount = 0;
let notHarmfulCount = 0;
let results = [];

csv.parse(fs.readFileSync(argv.changesets), (error, rows) => {
    for (var i = 0; i < rows.length; i++) {
        let row = rows[i]

        if (i < parseInt(argv.startRow)) continue;

        // 15th column in the csv file is the harmful column.
        let harmful = row[15];

        if ((harmful === 'True') && harmfulCount < parseInt(argv.harmful)) {
            results.push(row);
            harmfulCount += 1;
        } else if ((harmful === 'False') && (notHarmfulCount < parseInt(argv.notHarmful))) {
            results.push(row);
            notHarmfulCount += 1;
        }
    }

    csv.stringify(results, (error, resultsAsString) => {
        process.stdout.write(resultsAsString);
    });
});
