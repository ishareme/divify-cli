'use strict';

const aixos = require('axios');
const urlJoin = require('url-join');
const semver = require('semver');

module.exports = {
    getNpmInfo,
    getNpmVersion,
    getNpmSemverVersion,
    getDefaultRegistry,
    getNpmLatestVersion,
};

function getNpmInfo(npmName, registry) {
    if (!npmName) return null;
    registry = registry || getDefaultRegistry(true);
    const npmInfoUrl = urlJoin(registry, npmName);
    return aixos
        .get(npmInfoUrl)
        .then((res) => {
            if (res.status === 200) {
                return res.data;
            }
            return null;
        })
        .catch((err) => {
            return Promise.reject(err);
        });
}

function getDefaultRegistry(isOriginal = false) {
    return isOriginal
        ? 'https://registry.npmjs.org'
        : 'https://registry.npm.taobao.org';
}

async function getNpmVersion(npmName, registry) {
    const data = await getNpmInfo(npmName, registry);
    if (data) {
        return Object.keys(data.versions);
    }
    return [];
}

function getSemverVersions(baseVersion, versions) {
    // 过滤出大于当前版本号的  排序 b>a
    return versions
        .filter((version) => semver.satisfies(version, `^${baseVersion}`))
        .sort((a, b) => semver.gt(b, a));
}

async function getNpmSemverVersion(baseVersion, npmName, registry) {
    const versions = await getNpmVersion(npmName, registry);
    const newVersion = getSemverVersions(baseVersion, versions);
    if (newVersion && newVersion.length > 0) {
        return newVersion[0];
    }
    return null;
}

async function getNpmLatestVersion(npmName, registry) {
    let versions = await getNpmVersion(npmName, registry);
    if (versions) {
        versions = versions.sort((a, b) => semver.gt(b, a));
        return versions[versions.length - 1];
    }
    return null;
}
