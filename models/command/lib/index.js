'use strict';

const semver = require('semver');
const colors = require('colors');
const log = require('@divify/log');

const LOWEST_NODE_VERSION = '12.0.0';

class Command {
    constructor(argv) {
        if (!argv) {
            throw new Error(colors.red('Command 参数不能为空'));
        }
        if (!Array.isArray(argv)) {
            throw new Error(colors.red('Command 参数必须为数组'));
        }
        if (argv.length < 1) {
            throw new Error(colors.red('Command 参数数组不能为空'));
        }
        this._argv = argv;
        let runner = new Promise((resolve, reject) => {
            let chain = Promise.resolve();
            chain = chain.then(() => {
                // 检测node版本
                this.checkNodeVersion();
            });
            chain = chain.then(() => {
                this.initArgs();
            });
            chain = chain.then(() => {
                this.init();
            });
            chain = chain.then(() => {
                this.exec();
            });
            chain.catch((err) => {
                log.error('[ err ]', err.message);
            });
        });
    }
    init() {
        throw new Error(colors.red('Command init 必须实现重写'));
    }
    exec() {
        throw new Error(colors.red('Command exec 必须实现重写'));
    }

    initArgs() {
        this._cmd = this._argv[this._argv.length - 1];
        this._argv = this._argv.slice(0, this._argv.length - 1);
        console.log('[ this._argv ]', this._argv);
    }
    checkNodeVersion() {
        // 获取当前node版本号
        const currentVersion = process.version;
        const lowestVersion = LOWEST_NODE_VERSION;
        // 对比 当前版本是否大于 最低版本
        if (!semver.gte(currentVersion, lowestVersion)) {
            throw new Error(
                colors.red(
                    `divify cli 需要安装 v${lowestVersion} 以上版本的 Node.js`
                )
            );
        }
    }
}

module.exports = Command;
