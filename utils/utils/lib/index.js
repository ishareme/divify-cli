'use strict';

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]';
}

function spinnerStart(msg = 'loading...', spinnerSting = '|/-\\') {
    const Spinner = require('cli-spinner').Spinner;
    var spinner = new Spinner(msg + ' %s');
    spinner.setSpinnerString(spinnerSting);
    spinner.start();
    return spinner;
}
function sleep(time = 1000) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

// 兼容window
function spawn(command, args, options) {
    const win32 = process.platform === 'win32';

    const cmd = win32 ? 'cmd' : command;
    const cmdArg = win32 ? ['/c'].concat(command, args) : args;

    return require('child_process').spawn(cmd, cmdArg, options || {});
}
function spawnAsync(command, args, options) {
    return new Promise((resolve, reject) => {
        const p = spawn(command, args, options);
        p.on('error', (e) => reject(e));
        p.on('exit', (c) => resolve(c));
    });
}

module.exports = {
    isObject,
    spinnerStart,
    sleep,
    spawn,
    spawnAsync,
};
