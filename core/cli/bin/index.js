#! /usr/bin/env node

// const utils = require("@divify/utils");

// const r = utils();
// console.log("[ r ]", r);
// console.log("[ bin core ]");

const importLocal = require('import-local');

if (importLocal(__filename)) {
    require('npmlog').info('cli', '正在使用 divify cli 本地版本');
} else {
    require('../lib')(process.argv.slice(2));
}
