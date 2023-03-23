'use strict';

const path = require('path');
const fse = require('fs-extra');
const pkgDir = require('pkg-dir').sync;
const pathExists = require('path-exists').sync;
const npminstall = require('npminstall');
const { isObject } = require('@divify/utils');
const formatPath = require('@divify/format-path');
const {
    getDefaultRegistry,
    getNpmLatestVersion,
} = require('@divify/get-npm-info');

class Package {
    constructor(options) {
        if (!options || !isObject(options)) {
            throw new Error('Package类的options参数必须为对象');
        }
        // package 路径
        this.targetPath = options.targetPath;
        //缓存package路径
        this.storeDir = options.storeDir;
        // package的name
        this.packageName = options.packageName;
        // package的version
        this.packageVersion = options.packageVersion;
        // package缓存目录前缀
        this.cacheFilePathPrefix = this.packageName.replace('/', '_');
    }

    async prepare() {
        if (this.storeDir && !pathExists(this.storeDir)) {
            fse.mkdirsSync(this.storeDir);
        }
        if (this.packageVersion === 'latest') {
            this.packageVersion = await getNpmLatestVersion(this.packageName);
            console.log('[ this.packageVersion ]', this.packageVersion);
        }
    }

    get cacheFilePath() {
        return path.resolve(
            this.storeDir,
            `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`
        );
    }
    getSpecificCacheFilePath(packageVersion) {
        return path.resolve(
            this.storeDir,
            `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`
        );
    }

    // 判断当前package是否存在
    async exists() {
        // 缓存模式
        if (this.storeDir) {
            await this.prepare();
            return pathExists(this.cacheFilePath);
        } else {
            return pathExists(this.targetPath);
        }
    }

    // 安装package
    async install() {
        await this.prepare();
        return npminstall({
            root: this.targetPath,
            storeDir: this.storeDir,
            registry: getDefaultRegistry(true),
            pkgs: [
                {
                    name: this.packageName,
                    version: this.packageVersion,
                },
            ],
        });
    }

    // 更新package
    async update() {
        await this.prepare();
        // 获取最新的版本号
        const latestPackageVersion = await getNpmLatestVersion(
            this.packageName
        );
        const latestFilePath =
            this.getSpecificCacheFilePath(latestPackageVersion);
        // 查询最新版本号是否存在 如果不存在 则直接安装
        if (!pathExists(latestFilePath)) {
            await npminstall({
                root: this.targetPath,
                storeDir: this.storeDir,
                registry: getDefaultRegistry(true),
                pkgs: [
                    {
                        name: this.packageName,
                        version: latestPackageVersion,
                    },
                ],
            });
            this.packageVersion = latestPackageVersion;
        } else {
            this.packageVersion = latestPackageVersion;
        }
    }

    //获取入口文件的路径
    getRootFilePath() {
        function _getRootFile(targetPath) {
            // 获取package.json 所在的目录 pkg-dir
            const dir = pkgDir(targetPath);
            if (dir) {
                // 读取package.json - require()
                const pkgFile = require(path.resolve(dir, 'package.json'));
                // 寻找main/lib - path
                if (pkgFile && pkgFile.main) {
                    // 对path 路径兼容
                    return formatPath(path.resolve(dir, pkgFile.main));
                }
            }
            return null;
        }
        if (this.storeDir) {
            return _getRootFile(this.cacheFilePath);
        } else {
            return _getRootFile(this.targetPath);
        }
    }
}

module.exports = Package;
