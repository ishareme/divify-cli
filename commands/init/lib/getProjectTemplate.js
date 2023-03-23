const request = require('@divify/request');

module.exports = function () {
    return request({
        url: '/project/template',
    });
};
