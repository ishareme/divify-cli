'use strict';

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const glob = require('glob');
const Command = require('@divify/command');
const Package = require('@divify/package');
const log = require('@divify/log');
const { spinnerStart, sleep, spawnAsync } = require('@divify/utils');
const inquirer = require('inquirer');
const semver = require('semver');
const userHome = require('user-home');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const DEFAULT_CLI_HOME = '.divify-cli';

//命令白名单 防止 rm -rf
const WHITE_COMMAND = ['npm', 'cnpm'];

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose('projectName', this.projectName);
        log.verbose('force', this.force);
    }
    async exec() {
        try {
            // 准备阶段
            const projectInfo = await this.prepare();
            if (projectInfo) {
                this.projectInfo = projectInfo;
                // 下载模板
                await this.downloadTemplate();
                // 安装模板
                await this.installTemplate();
            }
        } catch (error) {
            log.error(error.message);
            if (process.env.LOG_LEVEL === 'verbose') {
                console.log('[ error ]', error);
            }
        }
    }

    async prepare() {
        // 判断项目模板是否存在
        const template = await getProjectTemplate();
        if (!template || template.length === 0) {
            throw new Error('项目模板不存在');
        }
        this.template = template;
        const localPath = process.cwd();
        // const localPath = path.resolve('.')
        // 判断当前目录是否为空
        const isEmpty = this.isDirEmpty(localPath);
        let isContinue = false;
        if (!isEmpty) {
            if (!this.force) {
                // 询问是否继续创建
                const answer = await inquirer.prompt({
                    type: 'confirm',
                    message: '当前文件夹不为空，是否继续创建项目？',
                    name: 'isContinue',
                    default: false,
                });
                isContinue = answer.isContinue;
                if (!isContinue) {
                    return;
                }
            }
            // 是否启动强制force
            if (isContinue || this.force) {
                // 清空前做二次确认
                const { confirmDelete } = await inquirer.prompt({
                    type: 'confirm',
                    message: '是否确认清空当前目录下的文件？',
                    name: 'confirmDelete',
                    default: false,
                });
                if (confirmDelete) {
                    // 清空目录
                    fse.emptyDirSync(localPath);
                }
            }
        }
        // return 项目基础信息 (object)
        return this.getProjectInfo();
    }

    async getProjectInfo() {
        function isValidName(v) {
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(
                v
            );
        }
        let projectInfo = {};
        let isProjectNameValid = false;
        if (isValidName(this.projectName)) {
            isProjectNameValid = true;
            projectInfo.projectName = this.projectName;
        }
        // 选择创建项目或者组件
        let { type } = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: '请选择初始化类型',
            default: TYPE_PROJECT,
            choices: [
                {
                    name: '项目',
                    value: TYPE_PROJECT,
                },
                {
                    name: '组件',
                    value: TYPE_COMPONENT,
                },
            ],
        });
        this.template = this.template.filter(
            (tmp) => tmp.tag && tmp.tag.includes(type)
        );
        console.log('[ this.template ]', this.template);
        const title = type === TYPE_PROJECT ? '项目' : '组件';
        const projectNamePrompt = {
            type: 'input',
            name: 'projectName',
            message: `请输入${title}名称`,
            default: '',
            validate: function (v) {
                const done = this.async();
                setTimeout(function () {
                    // 1.首字符必须为英文字符
                    // 2.尾字符必须为英文或数字，不能为字符
                    // 3.字符仅允许"-_"
                    if (!isValidName(v)) {
                        done(`请输入合法的${title}名称`);
                        return;
                    }
                    done(null, true);
                }, 0);
            },
            filter: function (v) {
                return v;
            },
        };
        const projectPrompt = [
            {
                type: 'input',
                name: 'projectVersion',
                message: `请输入${title}版本号`,
                default: '1.0.0',
                validate: function (v) {
                    const done = this.async();
                    setTimeout(function () {
                        if (!!!semver.valid(v)) {
                            done(`请输入合法的${title}版本号`);
                            return;
                        }
                        done(null, true);
                    }, 0);
                },
                filter: function (v) {
                    const version = semver.valid(v);
                    if (!!version) {
                        return version;
                    } else {
                        return v;
                    }
                },
            },
            {
                type: 'list',
                name: 'projectTemplate',
                message: `请选择${title}模板`,
                default: TYPE_PROJECT,
                choices: this.createTemplateChoices(),
            },
        ];
        if (!isProjectNameValid) {
            projectPrompt.unshift(projectNamePrompt);
        }

        if (type === TYPE_PROJECT) {
            // 获取项目基本信息
            const project = await inquirer.prompt(projectPrompt);
            projectInfo = {
                ...projectInfo,
                type,
                ...project,
            };
        } else if (type === TYPE_COMPONENT) {
            // 获取组件基本信息
            projectPrompt.push({
                type: 'input',
                name: 'componentDescription',
                message: '请输入组件描述信息',
                default: '',
                validate: function (v) {
                    const done = this.async();
                    setTimeout(function () {
                        if (!v) {
                            done(`请输入组件描述信息`);
                            return;
                        }
                        done(null, true);
                    }, 0);
                },
            });
            const project = await inquirer.prompt(projectPrompt);
            projectInfo = {
                ...projectInfo,
                type,
                ...project,
            };
        }

        // 项目名称转化为 AbcEfg -> abc-efg
        if (projectInfo.projectName) {
            projectInfo.name = projectInfo.projectName;
            projectInfo.className = require('kebab-case')(
                projectInfo.projectName
            ).replace(/^-/g, '');
        }
        if (projectInfo.projectVersion) {
            projectInfo.version = projectInfo.projectVersion;
        }
        if (projectInfo.componentDescription) {
            projectInfo.description = projectInfo.componentDescription;
        }
        // return 项目基础信息 (object)
        return projectInfo;
    }

    async downloadTemplate() {
        const { projectTemplate } = this.projectInfo;
        const templateInfo = this.template.find(
            (item) => item.npmName === projectTemplate
        );
        this.templateInfo = templateInfo;
        const targetPath = path.resolve(userHome, DEFAULT_CLI_HOME, 'template');
        const storeDir = path.resolve(
            userHome,
            DEFAULT_CLI_HOME,
            'template',
            'node_modules'
        );
        const { npmName, version } = templateInfo;
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName: npmName,
            packageVersion: version,
        });
        if (!(await templateNpm.exists())) {
            const spinner = spinnerStart('正在下载模板...');
            try {
                await templateNpm.install();
            } catch (error) {
                throw error;
            } finally {
                await sleep();
                spinner.stop(true);
                if (await templateNpm.exists()) {
                    log.success('下载模板成功');
                    this.templateNpm = templateNpm;
                }
            }
        } else {
            const spinner = spinnerStart('正在更新模板...');
            try {
                await templateNpm.update();
            } catch (error) {
                throw error;
            } finally {
                await sleep();
                spinner.stop(true);
                if (await templateNpm.exists()) {
                    log.success('更新模板成功');
                    this.templateNpm = templateNpm;
                }
            }
        }
        // 通过项目模板api获取项目模板信息
        //  通过egg.js搭建一套后端系统
        //  通过npm存储项目模板
        //  讲项目模板信息存储到mongoDB数据库中
        //  通过egg.js 获取mongoDB 中的数据 并且通过api返回
    }

    async installTemplate() {
        if (this.templateInfo) {
            if (!this.templateInfo.type) {
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
            }
            if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
                // 标准安装
                await this.installNormalTemplate();
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                // 自定义安装
                await this.installCustomTemplate();
            } else {
                throw new Error('项目模板类型无法识别');
            }
        } else {
            throw new Error('项目模板不存在');
        }
        console.log('[ thistemplate ]', this.templateInfo);
    }
    async installNormalTemplate() {
        let spinner = spinnerStart('正在安装模板...');
        await sleep();
        try {
            // 拷贝模板代码至当前目录
            const templatePath = path.resolve(
                this.templateNpm.cacheFilePath,
                'template'
            );
            const targetPath = process.cwd();
            // 不存在的时候创建
            fse.ensureDirSync(templatePath);
            fse.ensureDirSync(targetPath);
            // 拷贝模板
            fse.copySync(templatePath, targetPath);
        } catch (error) {
            throw error;
        } finally {
            spinner.stop(true);
            log.success('模板安装成功');
        }

        // ejs 生成
        // 定义ignore 等
        const ignore = [
            '**/node_modules/**',
            ...(this.templateInfo.ignore || []),
        ];
        await this.ejsRender({
            ignore,
        });

        // 安装依赖
        const { installCommand, startCommand } = this.templateInfo;
        await this.execCommand(
            installCommand,
            '安装命令开始执行...',
            '依赖安装执行失败'
        );
        await this.execCommand(
            startCommand,
            '启动命令开始执行...',
            '项目启动执行失败'
        );
    }
    async installCustomTemplate() {
        // 查询自定义模板的入口文件
        if (await this.templateNpm.exists()) {
            const rootFile = this.templateNpm.getRootFilePath();
            if (fs.existsSync(rootFile)) {
                log.notice('开始执行自定义模板');
                const templatePath = path.resolve(
                    this.templateNpm.cacheFilePath,
                    'template'
                );
                const options = {
                    templateInfo: this.templateInfo,
                    projectInfo: this.projectInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd(),
                };
                const code = `require('${rootFile}')(${JSON.stringify(
                    options
                )})`;
                log.verbose('code', code);
                await spawnAsync('node', ['-e', code], {
                    stdio: 'inherit',
                    cwd: process.cwd(),
                });
                log.success('自定义模板安装成功');
            } else {
                throw new Error('自定义模板入口文件不存在！');
            }
        }
    }

    async execCommand(command, startMsg, errorMsg) {
        let result;
        if (command) {
            const cmdArray = command.split(' ');
            const cmd = cmdArray[0];
            if (!this.checkCommand(cmd)) {
                throw new Error('执行命令未在白名单中，命令：' + command);
            }
            const args = cmdArray.slice(1);
            log.info(startMsg);
            result = await spawnAsync(cmd, args, {
                stdio: 'inherit',
                cwd: process.cwd(),
            });
        }
        if (result !== 0) {
            throw new Error(errorMsg);
        }
        return result;
    }

    async ejsRender(options) {
        const dir = process.cwd();
        return new Promise((resolve, reject) => {
            glob(
                '**',
                {
                    cwd: dir,
                    ignore: options.ignore,
                    nodir: true,
                },
                (err, files) => {
                    if (err) {
                        reject(err);
                    }
                    Promise.all(
                        files.map((file) => {
                            const filePath = path.join(dir, file);
                            return new Promise((rlv, rjc) => {
                                ejs.renderFile(
                                    filePath,
                                    this.projectInfo,
                                    {},
                                    (e, result) => {
                                        if (e) {
                                            rjc(e);
                                        } else {
                                            fse.writeFileSync(filePath, result);
                                            rlv(result);
                                        }
                                    }
                                );
                            });
                        })
                    )
                        .then(() => resolve())
                        .catch((err) => reject(err));
                }
            );
        });
    }

    createTemplateChoices() {
        return this.template.map((item) => ({
            value: item.npmName,
            name: item.name,
        }));
    }

    isDirEmpty(localPath) {
        let fileList = fs.readdirSync(localPath);
        // 文件过滤
        fileList = fileList.filter(
            (file) =>
                !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
        );
        return !fileList || fileList.length <= 0;
    }

    checkCommand(cmd) {
        return WHITE_COMMAND.indexOf(cmd) > -1 ? cmd : null;
    }
}

function init(argv) {
    return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
