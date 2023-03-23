'use strict';

const path = require('path');

function formatPath(p) {
    if (p && typeof p === 'string') {
        const sep = path.sep;
        if (sep === '/') {
            return p;
        }
        // window 下是 \ 要转化为 /
        else {
            return p.replace(/\\/g, '/');
        }
    }
    return p;
}

module.exports = formatPath;
