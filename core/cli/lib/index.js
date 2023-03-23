'use strict';

const path = require('path');
const semver = require('semver');
const colors = require('colors');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const commander = require('commander');
const log = require('@divify/log');
const exec = require('@divify/exec');
const pkg = require('../package.json');
const constant = require('./constants');

const program = new commander.Command();

module.exports = core;

async function core() {
    try {
        // 预处理
        await prepare();
        // 注册指令
        registerCommand();
    } catch (error) {
        log.error(error.message);
        if (program.debug) {
            console.log('[ error ]', error);
        }
    }
}

function registerCommand() {
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option(
            '-tp, --targetPath <targetPath>',
            '是否指定本地调试文件路径',
            ''
        );

    program
        .command('init [projectName]')
        .option('-f, --force', '是否强制初始化项目')
        .action(exec);

    // 监听targetPath 执行业务逻辑之前执行
    program.on('option:targetPath', function () {
        // 通过环境变量 设置参数 进行代码耦合
        process.env.CLI_TARGET_PATH = program.targetPath;
    });

    // 对debug模式的监听
    program.on('option:debug', function () {
        if (program.debug) {
            process.env.LOG_LEVEL = 'verbose';
        } else {
            process.env.LOG_LEVEL = 'info';
        }
        log.level = process.env.LOG_LEVEL;
    });
    // 对未知命令的监听
    program.on('command:*', function (obj) {
        const availableCommands = program.commands.map((cmd) => cmd.name());
        log.error(colors.red('未知命令：' + obj[0]));
        if (availableCommands.length > 0) {
            log.error(colors.red('可用命令：' + availableCommands.join(',')));
        }
    });

    program.parse(process.argv);

    if (program.args && program.args.length < 1) {
        program.outputHelp();
    }
}

async function prepare() {
    // 检测包版本
    checkPkgVersion();
    // 检测node版本 下沉到Command执行
    // checkNodeVersion();
    // 检测是否root用户
    checkRoot();
    // 检测用户主目录
    checkUserHome();
    // 检测环境变量
    checkEnv();
    // 检测是否需要更新包
    await checkGlobalUpdate();
}

async function checkGlobalUpdate() {
    // 获取当前版本号和模块名
    const currentVersion = pkg.version;
    const npmName = pkg.name;
    // 调用npm api 获取所有版本号
    const { getNpmSemverVersion } = require('@divify/get-npm-info');
    const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
    // 提取所有版本号  对比哪些版本号大于当前版本号
    // 获取最新版本号 提示用户更新到最新版本号
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
        log.warn(
            colors.yellow(
                '更新提示',
                `请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${lastVersion}
            更新命令：npm install -g ${npmName}`
            )
        );
    }
}

function checkEnv() {
    const dotenv = require('dotenv');
    const dotenvPath = path.resolve(userHome, '.env');
    if (pathExists(dotenvPath)) {
        dotenv.config({
            path: dotenvPath,
        });
    }
    createDefaultConfig();
}
function createDefaultConfig() {
    const cliConfig = {
        home: userHome,
    };
    if (process.env.CLI_HOME) {
        cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME);
    } else {
        cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME);
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome;
}

function checkUserHome() {
    if (!userHome || !pathExists(userHome)) {
        throw new Error(colors.red('当前登录用户主目录不存在'));
    }
}

function checkRoot() {
    const rootCheck = require('root-check');
    rootCheck();
}

// function checkNodeVersion() {
//     // 获取当前node版本号
//     const currentVersion = process.version;
//     const lowestVersion = constant.LOWEST_NODE_VERSION;
//     // 对比 当前版本是否大于 最低版本
//     if (!semver.gte(currentVersion, lowestVersion)) {
//         throw new Error(
//             colors.red(
//                 `divify cli 需要安装 v${lowestVersion} 以上版本的 Node.js`
//             )
//         );
//     }
// }

function checkPkgVersion() {
    log.notice('[ version ]', pkg.version);
}
