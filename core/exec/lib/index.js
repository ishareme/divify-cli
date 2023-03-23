'use strict';

const path = require('path');
const Package = require('@divify/package');
const log = require('@divify/log');
const { spawn } = require('@divify/utils');

const SETTING = {
    // init: '@divify/init',
    init: '@imooc-cli/init',
};
const CACHE_DIR = 'dependencies';

async function exec() {
    let targetPath = process.env.CLI_TARGET_PATH;
    const homePath = process.env.CLI_HOME_PATH;
    let storeDir = '';
    let pkg;
    log.verbose('targetPath', targetPath);

    const cmdObj = arguments[arguments.length - 1];
    const cmdName = cmdObj.name();
    const packageName = SETTING[cmdName];
    const packageVersion = 'latest';

    if (!targetPath) {
        // 生成缓存路径
        targetPath = path.resolve(homePath, CACHE_DIR);
        storeDir = path.resolve(targetPath, 'node_modules');
        log.verbose('targetPath', targetPath);
        log.verbose('storeDir', storeDir);

        pkg = new Package({
            targetPath,
            storeDir,
            packageName,
            packageVersion,
        });
        if (await pkg.exists()) {
            // 更新package
            console.log('[ 更新package ]');
            await pkg.update();
        } else {
            await pkg.install();
            // 安装package
        }
    } else {
        pkg = new Package({
            targetPath,
            packageName,
            packageVersion,
        });
    }
    const rootFile = pkg.getRootFilePath();
    if (rootFile) {
        try {
            // 当前进程中调用
            // require(rootFile).call(null, Array.from(arguments));
            // node子进程中调用
            const args = Array.from(arguments);
            const cmd = args[args.length - 1];
            const o = Object.create(null);
            // 参数瘦身
            Object.keys(cmd).forEach((key) => {
                if (
                    cmd.hasOwnProperty(key) &&
                    !key.startsWith('_') &&
                    key !== 'parent'
                ) {
                    o[key] = cmd[key];
                }
            });
            args[args.length - 1] = o;
            const code = `require('${rootFile}').call(null, ${JSON.stringify(
                args
            )});`;
            const child = spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit', //子进程中执行的结果直接在父进程中展示打印 包括细节动画
            });
            child.on('error', (e) => {
                log.error(e.message);
                process.exit(1); //错误结果
            });
            child.on('exit', (e) => {
                log.verbose('命令执行成功：', e);
                process.exit(e);
            });
        } catch (error) {
            log.error(error.message);
        }
    }
}

module.exports = exec;
