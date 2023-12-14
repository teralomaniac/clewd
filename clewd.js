/*
* https://rentry.org/teralomaniac_clewd
* https://github.com/teralomaniac/clewd
*/
'use strict';

const {createServer: Server, IncomingMessage, ServerResponse} = require('node:http'), {createHash: Hash, randomUUID, randomInt, randomBytes} = require('node:crypto'), {TransformStream, ReadableStream} = require('node:stream/web'), {Readable, Writable} = require('node:stream'), {Blob} = require('node:buffer'), {existsSync: exists, writeFileSync: write, createWriteStream} = require('node:fs'), {join: joinP} = require('node:path'), {ClewdSuperfetch: Superfetch, SuperfetchAvailable} = require('./lib/clewd-superfetch'), {AI, fileName, genericFixes, bytesToSize, setTitle, checkResErr, Replacements, Main} = require('./lib/clewd-utils'), ClewdStream = require('./lib/clewd-stream');

/******************************************************* */
let currentIndex, Firstlogin = true, changeflag = 0, changetime = 0, totaltime, invalidtime = 0, uuidOrgArray = [], model, tokens, apiKey, timestamp = Date.now();

const events = require('events'), CookieChanger = new events.EventEmitter();
require('events').EventEmitter.defaultMaxListeners = 0;

CookieChanger.on('ChangeCookie', () => {
    setTimeout(() => {
        changeflag = 0;
        Proxy && Proxy.close();
        console.log(`Changing Cookie...\n`);
        Proxy.listen(Config.Port, Config.Ip, onListen);
        Proxy.on('error', (err => {
            console.error('Proxy error\n%o', err);
        }));
        timestamp = Date.now();
        invalidtime += 1;
    }, !Config.rProxy || Config.rProxy === AI.end() ? 15000 + timestamp - Date.now() : 0);
});

const convertToType = value => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return parseInt(value);
    return value;
}, CookieCleaner = () => {
    Config.CookieArray.splice(Config.CookieArray.indexOf(Config.Cookie), 1);
    Config.Cookie = '';
    writeSettings(Config);
    currentIndex = (currentIndex - 1 + Config.CookieArray.length) % Config.CookieArray.length;
}, padtxt = content => {
    const {countTokens} = require('@anthropic-ai/tokenizer');
    const placeholder = Config.padtxt_placeholder || randomBytes(randomInt(5, 15)).toString('hex');
    tokens = countTokens(content);
    const padding = placeholder.repeat(Math.floor(Math.max(1000, Config.Settings.padtxt - tokens) / countTokens(placeholder.trim())));
    content = content.includes('<|padtxt|>') ? content.replace(/<\|padtxt\|>/gm, padding) : !apiKey ? padding + '\n\n\n' + content.trim() : content;
    return content;
}, xmlPlot = (content, nonsys = false) => {
    //role合并
    const MergeDisable = content.includes('<|Merge Disable|>');
    const MergeHumanDisable = content.includes('<|Merge Human Disable|>');
    const MergeAssistantDisable = content.includes('<|Merge Assistant Disable|>');
    if (!MergeDisable) {
        if (content.includes('<|Merge System Disable|>')) {
            content = content.replace(/(\n\n|^\s*)xmlPlot:\s*/gm, '$1');
        }
        if (!MergeHumanDisable) {
            nonsys ? content = content.replace(/(\n\n|^\s*)xmlPlot:/g, '\n\nHuman:') : content = content.replace(/(\n\n|^\s*)(?<!\n\n(Human|Assistant):.*?)xmlPlot:\s*/gs, '$1').replace(/(\n\n|^\s*)xmlPlot:/g, '\n\nHuman:');
            content = content.replace(/(?:\n\n|^\s*)Human:(.*?(?:\n\nAssistant:|$))/gs, function(match, p1) {return '\n\nHuman:' + p1.replace(/\n\nHuman:\s*/g, '\n\n')});
        }
        if (!MergeAssistantDisable) {
            content = content.replace(/\n\nAssistant:(.*?(?:\n\nHuman:|$))/gs, function(match, p1) {return '\n\nAssistant:' + p1.replace(/\n\nAssistant:\s*/g, '\n\n')});
        }
    }
    content = content.replace(/(\n\n|^\s*)xmlPlot:\s*/gm, '$1');
    //自定义插入
    content = content.replace(/(<\/?)PrevAssistant>/gm, '$1@1>').replace(/(<\/?)PrevHuman>/gm, '$1@2>');
    let splitContent = content.split(/\n\n(?=Assistant:|Human:)/g);
    let match;
    while ((match = /<@(\d+)>(.*?)<\/@\1>/gs.exec(content)) !== null) {
        let index = splitContent.length - parseInt(match[1]) - 1;
        if (index >= 0) {
            splitContent[index] += '\n\n' + match[2];
        }
        content = content.replace(match[0], '');
    }
    content = splitContent.join('\n\n');
    content = content.replace(/<@(\d+)>.*?<\/@\1>/gs, '');
    //正则
    while ((match = /<regex>"(\/?)(.*)\1(.*)" *: *"(.*?)"<\/regex>/gm.exec(content)) !== null) {
        try {
            content = content.replace(new RegExp(match[2], match[3]), match[4]);
        } catch (error) {}
        content = content.replace(match[0], '');
    }
    content = content.replace(/(\r\n|\r|\\n)/gm, '\n');
    //二次role合并
    if (!MergeDisable) {
        if (!MergeHumanDisable) {
            content = content.replace(/(?:\n\n|^\s*)Human:(.*?(?:\n\nAssistant:|$))/gs, function(match, p1) {return '\n\nHuman:' + p1.replace(/\n\nHuman:\s*/g, '\n\n')});
        }
        if (!MergeAssistantDisable) {
            content = content.replace(/\n\nAssistant:(.*?(?:\n\nHuman:|$))/gs, function(match, p1) {return '\n\nAssistant:' + p1.replace(/\n\nAssistant:\s*/g, '\n\n')});
        }
    }
    //Plain Prompt
    let segcontentHuman = content.split('\n\nHuman:');
    let segcontentlastIndex = segcontentHuman.length - 1;
    if (!apiKey && segcontentlastIndex >= 2 && segcontentHuman[segcontentlastIndex].includes('<|Plain Prompt Enable|>') && !content.includes('\n\nPlainPrompt:')) {
        content = segcontentHuman.slice(0, segcontentlastIndex).join('\n\nHuman:') + '\n\nPlainPrompt:' + segcontentHuman.slice(segcontentlastIndex).join('\n\nHuman:').replace(/\n\nHuman: *PlainPrompt:/, '\n\nPlainPrompt:');
    }
    //消除空XML tags、两端空白符和多余的\n
    content = content.replace(/\s*<\|curtail\|>\s*/g, '\n')
        .replace(/\n<\/(card|hidden|META)>\s+?<\1>\n/g, '\n')
        .replace(/\n<(\/?card|example|hidden|plot|META)>\s+?<\1>/g, '\n<$1>')
        .replace(/\n(?:<!--.*?-->|Here.*?:)?\n<(card|example|hidden|plot|META)>\s+?<\/\1>/g, '')
        .replace(/(?<=(: |\n)<(card|hidden|example|plot|META|EOT)>\n)\s*/g, '')
        .replace(/\s*(?=\n<\/(card|hidden|example|plot|META|EOT)>(\n|$))/g, '')
        .replace(/(?<=\n)\n(?=\n)/g, '');
    //确保格式正确
    if (apiKey) {
        content = content.replace(/\n\n(Assistant|Human):(?!.*?\n\n(Assistant|Human):).*$/s, function(match, p1) {return p1 === 'Assistant' ? match : match + '\n\nAssistant: '}).replace(/\s*<\|noAssistant\|>\s*(.*?)(?:\n\nAssistant:\s*)?$/s, '\n\n$1');
        content.includes('<|reverseHA|>') && (content = content.replace(/\s*<\|reverseHA\|>\s*/g, '\n\n').replace(/Assistant|Human/g, function(match) {return match === 'Human' ? 'Assistant' : 'Human'}).replace(/\n(A|H): /g, function(match, p1) {return p1 === 'A' ? '\nH: ' : '\nA: '}));
        return content.replace(Config.Settings.padtxt ? /\s*<\|(?!padtxt).*?\|>\s*/g : /\s*<\|.*?\|>\s*/g, '\n\n').trim().replace(/^(Human|Assistant):/, '\n\n$&').replace(/\n\n(Human|Assistant):$/, '$& ');
    } else {
        return content.replace(Config.Settings.padtxt ? /\s*<\|(?!padtxt).*?\|>\s*/g : /\s*<\|.*?\|>\s*/g, '\n\n').trim().replace(/^Human:|\n\nAssistant:$/g, '');
    }
};
/******************************************************* */

let ChangedSettings, UnknownSettings, Logger;

const ConfigPath = joinP(__dirname, './config.js'), LogPath = joinP(__dirname, './log.txt'), Conversation = {
    char: null,
    uuid: null,
    depth: 0
}, cookies = {};

let uuidOrg, curPrompt = {}, prevPrompt = {}, prevMessages = [], prevImpersonated = false, Config = {
    Cookie: '',
    CookieArray: [],
    Cookiecounter: 3,
    CookieIndex: 0,
    ProxyPassword: '',
    Ip: (process.env.Cookie || process.env.CookieArray) ? '0.0.0.0' : '127.0.0.1',
    Port: process.env.PORT || 8444,
    localtunnel: false,
    BufferSize: 1,
    SystemInterval: 3,
    rProxy: '',
    api_rProxy: '',
    padtxt_placeholder: '',
    PromptExperimentFirst: '',
    PromptExperimentNext: '',
    PersonalityFormat: '{{char}}\'s personality: {{personality}}',
    ScenarioFormat: 'Dialogue scenario: {{scenario}}',
    Settings: {
        RenewAlways: true,
        RetryRegenerate: false,
        PromptExperiments: true,
        SystemExperiments: true,
        PreventImperson: false,
        AllSamples: false,
        NoSamples: false,
        StripAssistant: false,
        StripHuman: false,
        PassParams: false,
        ClearFlags: true,
        PreserveChats: false,
        LogMessages: true,
        FullColon: true,
        padtxt: 15000,
        xmlPlot: true,
        Superfetch: true
    }
};

ServerResponse.prototype.json = async function(body, statusCode = 200, headers) {
    body = body instanceof Promise ? await body : body;
    this.headersSent || this.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...headers && headers
    });
    this.end('object' == typeof body ? JSON.stringify(body) : body);
    return this;
};

Array.prototype.sample = function() {
    return this[Math.floor(Math.random() * this.length)];
};

const updateParams = res => {
    updateCookies(res);
}, updateCookies = res => {
    let cookieNew = '';
    res instanceof Response ? cookieNew = res.headers?.get('set-cookie') : res?.superfetch ? cookieNew = res.headers?.['set-cookie'] : 'string' == typeof res && (cookieNew = res.split('\n').join(''));
    if (!cookieNew) {
        return;
    }
    let cookieArr = cookieNew.split(/;\s?/gi).filter((prop => false === /^(path|expires|domain|HttpOnly|Secure|SameSite)[=;]*/i.test(prop)));
    for (const cookie of cookieArr) {
        const divide = cookie.split(/^(.*?)=\s*(.*)/), cookieName = divide[1], cookieVal = divide[2];
        cookies[cookieName] = cookieVal;
    }
}, getCookies = () => {
    const cookieNames = Object.keys(cookies);
    return cookieNames.map(((name, idx) => `${name}=${cookies[name]}${idx === cookieNames.length - 1 ? '' : ';'}`)).join(' ').replace(/(\s+)$/gi, '');
}, deleteChat = async uuid => {
    if (!uuid) {
        return;
    }
    if (uuid === Conversation.uuid) {
        Conversation.uuid = null;
        Conversation.depth = 0;
    }
    if (Config.Settings.PreserveChats) {
        return;
    }
    try { //
        const res = await fetch(`${Config.rProxy || AI.end()}/api/organizations/${uuidOrg}/chat_conversations/${uuid}`, {
            headers: {
                ...AI.hdr(),
                Cookie: getCookies()
            },
            method: 'DELETE'
        });
        updateParams(res);
    } catch (err) {console.log(`[33mdeleteChat failed[0m`)}; //
}, onListen = async () => {
/***************************** */
    if (Firstlogin) {
        Firstlogin = false;
        console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings?.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings?.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
        Config.Settings.Superfetch && SuperfetchAvailable(true);
        if (Config.localtunnel) {
            const localtunnel = require('localtunnel');
            localtunnel({ port: Config.Port })
            .then((tunnel) => {
                console.log(`\nTunnel URL for outer websites: ${tunnel.url}/v1\n`);
            })
        }
        totaltime = Config.CookieArray.length;
    }
    if (Config.CookieArray?.length > 0) {
        Config.Cookie = Config.CookieArray[currentIndex];
        currentIndex = (currentIndex + 1) % Config.CookieArray.length;
        changetime += 1;
    }
    let percentage = ((changetime + Math.max(Config.CookieIndex - 1, 0)) / totaltime) * 100
    if (Config.Cookiecounter < 0 && percentage > 100) {
        console.log(`\n※※※Cookie cleanup completed※※※\n\n`);
        return process.exit();
    }
    try {
/***************************** */
    if ('SET YOUR COOKIE HERE' === Config.Cookie || Config.Cookie?.length < 1 || (Config.CookieArray?.length > 0 && invalidtime >= totaltime)) { //if ('SET YOUR COOKIE HERE' === Config.Cookie || Config.Cookie?.length < 1) {
        return console.log(`[33mNo cookie available, apiKey-Only mode enabled.[0m\n`); //throw Error('Set your cookie inside config.js');
    }
    updateCookies(Config.Cookie.replace(/^(sessionKey=)?/, 'sessionKey=')); //updateCookies(Config.Cookie);
    //console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
    //Config.Settings.Superfetch && SuperfetchAvailable(true);
    const accRes = await fetch((Config.rProxy || AI.end()) + '/api/organizations', {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    });
/**************************** */
    if (accRes.statusText === 'Forbidden' && Config.CookieArray?.length > 0) {
        CookieCleaner();
        console.log(`[31mExpired![0m`);
        Config.Cookiecounter < 0 && console.log(`[progress]: [32m${percentage.toFixed(2)}%[0m\n[length]: [33m${Config.CookieArray.length}[0m\n`);
        return CookieChanger.emit('ChangeCookie');
    }
/**************************** */
    await checkResErr(accRes);
    const accInfo = (await accRes.json())?.[0];
    if (!accInfo || accInfo.error) {
        throw Error(`Couldn't get account info: "${accInfo?.error?.message || accRes.statusText}"`);
    }
    if (!accInfo?.uuid) {
        throw Error('Invalid account id');
    }
    setTitle('ok');
    updateParams(accRes);
/**************************** */
    const accountRes = await fetch((Config.rProxy || AI.end()) + '/api/auth/current_account', {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    });
    await checkResErr(accountRes);
    const accountInfo = await accountRes.json();
/**************************** */
    console.log(Config.CookieArray?.length > 0 ? `(index: [36m${currentIndex || Config.CookieArray.length}[0m) Logged in %o` : 'Logged in %o', { //console.log('Logged in %o', {
        name: accInfo.name?.split('@')?.[0],
        mail: accountInfo.account.email_address, //
        capabilities: accInfo.capabilities,
    });
    uuidOrg = accInfo?.uuid;
/************************* */
    model = accountInfo.account.statsig.values.dynamic_configs["6zA9wvTedwkzjLxWy9PVe7yydI00XDQ6L5Fejjq/2o8="]?.value?.model;
    model != AI.mdl() && console.log(`[33m${model}[0m`);
    if (model != AI.mdl() && Config.Cookiecounter === -2) {
        CookieCleaner();
        return CookieChanger.emit('ChangeCookie');
    }
    const Overlap = uuidOrgArray.includes(uuidOrg) && percentage <= 100 && Config.CookieArray?.length > 0;
    !Overlap && uuidOrgArray.push(uuidOrg);
    const Unverified = !accountInfo.account.completed_verification_at;
    const abuseTag = accountInfo.account.statsig.values.feature_gates["4fDxNAVXgvks8yzKUoU+T+w3Qr3oYVqoJJVNYh04Mik="]?.secondary_exposures[0];
    const Banned = abuseTag.gateValue === 'true' && abuseTag.gate === 'segment:abuse';
    const Remain = accountInfo.messageLimit?.remaining;
    const Exceededlimit = (accountInfo.messageLimit?.type === 'approaching_limit' && Remain === 0) || accountInfo.messageLimit?.type === 'exceeded_limit';
    if (Remain) {
        changeflag = Math.max(Config.Cookiecounter - Remain, changeflag);
        console.log(`[33mApproachingLimit!: Remain ${Remain}[0m`);
    }
    if ((Overlap || Unverified || Banned) && Config.CookieArray?.length > 0) {
        Overlap ? console.log(`[31mOverlap![0m`) : Unverified ? console.log(`[31mUnverified![0m`) : Banned && console.log(`[31mBanned![0m`);
        CookieCleaner();
        Config.Cookiecounter < 0 && console.log(`[progress]: [32m${percentage.toFixed(2)}%[0m\n[length]: [33m${Config.CookieArray.length}[0m\n`);
        return CookieChanger.emit('ChangeCookie');
    }
/************************* */
    if (accInfo?.active_flags.length > 0) {
        let flagtype; //
        const now = new Date, formattedFlags = accInfo.active_flags.map((flag => {
            const days = ((new Date(flag.expires_at).getTime() - now.getTime()) / 864e5).toFixed(2);
            flagtype = flag.type; //
            return {
                type: flag.type,
                remaining_days: days
            };
        }));
        console.warn(`${'consumer_banned' === flagtype ? '[31m' : '[35m'}Your account has warnings[0m %o`, formattedFlags); //console.warn('[31mYour account has warnings[0m %o', formattedFlags);
        await Promise.all(accInfo.active_flags.map((flag => (async type => {
            if (!Config.Settings.ClearFlags) {
                return;
            }
            if ('consumer_restricted_mode' === type || 'consumer_banned' === type) { //if ('consumer_restricted_mode' === type) {
                return;
            }
            const req = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${Config.rProxy || AI.end()}/api/organizations/${uuidOrg}/flags/${type}/dismiss`, {
                headers: {
                    ...AI.hdr(),
                    Cookie: getCookies()
                },
                method: 'POST'
            });
            updateParams(req);
            const json = await req.json();
            console.log(`${type}: ${json.error ? json.error.message || json.error.type || json.detail : 'OK'}`);
        })(flag.type))));
/***************************** */
        if (Config.CookieArray?.length > 0) {
            console.log(`${'consumer_banned' === flagtype ? '[31mBanned' : '[35mRestricted'}![0m`);
            'consumer_banned' === flagtype && CookieCleaner();
            Config.Cookiecounter < 0 && console.log(`[progress]: [32m${percentage.toFixed(2)}%[0m\n[length]: [33m${Config.CookieArray.length}[0m\n`);
            return CookieChanger.emit('ChangeCookie');
        }
    }
    if (Config.Cookiecounter < 0 || Exceededlimit) {
        console.log(Config.Cookiecounter < 0 ? `[progress]: [32m${percentage.toFixed(2)}%[0m\n[length]: [33m${Config.CookieArray.length}[0m\n` : '[35mExceeded limit![0m\n');
        return CookieChanger.emit('ChangeCookie');
/***************************** */
    }
    const convRes = await fetch(`${Config.rProxy || AI.end()}/api/organizations/${uuidOrg}/chat_conversations`, {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    }), conversations = await convRes.json();
    updateParams(convRes);
    conversations.length > 0 && await Promise.all(conversations.map((conv => deleteChat(conv.uuid))));
/***************************** */
    invalidtime = 0;
    } catch (err) {
        console.error('[33mClewd:[0m\n%o', err);
        Config.CookieArray?.length > 0 && CookieChanger.emit('ChangeCookie');
    }
/***************************** */
}, writeSettings = async (config, firstRun = false) => {
    if (process.env.Cookie || process.env.CookieArray) return; //
    write(ConfigPath, `/*\n* https://rentry.org/teralomaniac_clewd\n* https://github.com/teralomaniac/clewd\n*/\n\n// SET YOUR COOKIE BELOW\n\nmodule.exports = ${JSON.stringify(config, null, 4)}\n\n/*\n BufferSize\n * How many characters will be buffered before the AI types once\n * lower = less chance of \`PreventImperson\` working properly\n\n ---\n\n SystemInterval\n * How many messages until \`SystemExperiments alternates\`\n\n ---\n\n Other settings\n * https://gitgud.io/ahsk/clewd/#defaults\n * and\n * https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md\n */`.trim().replace(/((?<!\r)\n|\r(?!\n))/g, '\r\n'));
    if (firstRun) {
        console.warn('[33mconfig file created!\nedit[0m [1mconfig.js[0m [33mto set your settings and restart the program[0m');
        process.exit(0);
    }
}, Proxy = Server((async (req, res) => {
    if ('OPTIONS' === req.method) {
        return ((req, res) => {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
            }).end();
        })(0, res);
    }
    switch (req.url) {
      case '/v1/models':
        res.json({
            data: [ {
/***************************** */
                id: 'claude-2.1'                },{
                id: 'claude-2.0'                },{
                id: 'claude-v1.3'               },{
                id: 'claude-v1.3-100k'          },{
                id: 'claude-v1.2'               },{
                id: 'claude-v1.0'               },{
                id: 'claude-instant-1.2'        },{
                id: 'claude-instant-v1.1'       },{
                id: 'claude-instant-v1.1-100k'  },{
                id: 'claude-instant-v1.0'       //id: AI.mdl()
/***************************** */
            } ]
        });
        break;

      case '/v1/chat/completions':
        ((req, res) => {
            setTitle('recv...');
            let fetchAPI;
            const abortControl = new AbortController, {signal} = abortControl;
            res.socket.on('close', (async () => {
                abortControl.signal.aborted || abortControl.abort();
            }));
            const buffer = [];
            req.on('data', (chunk => {
                buffer.push(chunk);
            }));
            req.on('end', (async () => {
                let clewdStream, titleTimer, samePrompt = false, shouldRenew = true, retryRegen = false;
                try {
                    const body = JSON.parse(Buffer.concat(buffer).toString()), temperature = Math.max(.1, Math.min(1, body.temperature));
                    let {messages} = body;
/************************* */
                    apiKey = req.headers.authorization?.match(/sk-ant-api\d\d-[\w-]{86}-[\w-]{6}AA/g);
                    let max_tokens_to_sample, stop_sequences;
                    if (apiKey) {
                        stop_sequences = body.stop;
                        max_tokens_to_sample = body.max_tokens;
                        model = body.model;
                        if (!model.includes('claude')) throw Error('Please change to claude model in "External"');
                    } else if (req.headers.authorization.includes('sk-ant-api')) {
                        throw Error('apiKey Wrong');
                    } else if (Config.ProxyPassword != '' && req.headers.authorization != 'Bearer ' + Config.ProxyPassword) {
                        throw Error('ProxyPassword Wrong');
                    } else if (Config.CookieArray?.length > 0 && invalidtime >= Config.CookieArray?.length) {
                        invalidtime = 0;
                        return CookieChanger.emit('ChangeCookie');
                    }
/************************* */
                    if (messages?.length < 1) {
                        throw Error('Select OpenAI as completion source');
                    }
                    if (!body.stream && 1 === messages.length && JSON.stringify(messages.sort() || []) === JSON.stringify([ {
                        role: 'user',
                        content: 'Hi'
                    } ].sort())) {
                        return res.json({
                            choices: [ {
                                message: {
                                    content: Main
                                }
                            } ]
                        });
                    }
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    body.stream && res.setHeader('Content-Type', 'text/event-stream');
                    if (!body.stream && messages?.[0]?.content?.startsWith('From the list below, choose a word that best represents a character\'s outfit description, action, or emotion in their dialogue')) {
                        return res.json({
                            choices: [ {
                                message: {
                                    content: 'neutral'
                                }
                            } ]
                        });
                    }
                    if (Config.Settings.AllSamples && Config.Settings.NoSamples) {
                        console.log('[33mhaving[0m [1mAllSamples[0m and [1mNoSamples[0m both set to true is not supported');
                        throw Error('Only one can be used at the same time: AllSamples/NoSamples');
                    }
                    //const model = AI.mdl();
                    curPrompt = {
                        firstUser: messages.find((message => 'user' === message.role)),
                        firstSystem: messages.find((message => 'system' === message.role)),
                        firstAssistant: messages.find((message => 'assistant' === message.role)),
                        lastUser: messages.findLast((message => 'user' === message.role)),
                        lastSystem: messages.findLast((message => 'system' === message.role && '[Start a new chat]' !== message.content)),
                        lastAssistant: messages.findLast((message => 'assistant' === message.role))
                    };
                    prevPrompt = {
                        ...prevMessages.length > 0 && {
                            firstUser: prevMessages.find((message => 'user' === message.role)),
                            firstSystem: prevMessages.find((message => 'system' === message.role)),
                            firstAssistant: prevMessages.find((message => 'assistant' === message.role)),
                            lastUser: prevMessages.findLast((message => 'user' === message.role)),
                            lastSystem: prevMessages.find((message => 'system' === message.role && '[Start a new chat]' !== message.content)),
                            lastAssistant: prevMessages.findLast((message => 'assistant' === message.role))
                        }
                    };
                    samePrompt = JSON.stringify(messages.filter((message => 'system' !== message.role)).sort()) === JSON.stringify(prevMessages.filter((message => 'system' !== message.role)).sort());
                    const sameCharDiffChat = !samePrompt && curPrompt.firstSystem?.content === prevPrompt.firstSystem?.content && curPrompt.firstUser?.content !== prevPrompt.firstUser?.content;
                    shouldRenew = Config.Settings.RenewAlways || !Conversation.uuid || prevImpersonated || !Config.Settings.RenewAlways && samePrompt || sameCharDiffChat;
                    retryRegen = Config.Settings.RetryRegenerate && samePrompt && null != Conversation.uuid;
                    samePrompt || (prevMessages = JSON.parse(JSON.stringify(messages)));
                    let type = '';
                    if (apiKey) { type = 'api'; } else if (retryRegen) { //if (retryRegen) {
                        type = 'R';
                        fetchAPI = await (async (signal, model) => {
                            let res;
                            const body = {
                                completion: {
                                    prompt: '',
                                    timezone: AI.zone(),
                                    model: model || AI.mdl()
                                },
                                organization_uuid: uuidOrg,
                                conversation_uuid: Conversation.uuid,
                                text: ''
                            };
                            let headers = {
                                ...AI.hdr(Conversation.uuid || ''),
                                Accept: 'text/event-stream',
                                Cookie: getCookies()
                            };
                            if (Config.Settings.Superfetch) {
                                const names = Object.keys(headers), values = Object.values(headers);
                                headers = names.map(((header, idx) => `${header}: ${values[idx]}`));
                            }
                            res = await (Config.Settings.Superfetch ? Superfetch : fetch)((Config.rProxy || AI.end()) + '/api/retry_message', {
                                stream: true,
                                signal,
                                method: 'POST',
                                body: JSON.stringify(body),
                                headers
                            });
                            updateParams(res);
                            await checkResErr(res);
                            return res;
                        })(signal, model);
                    } else if (shouldRenew) {
                        Conversation.uuid && await deleteChat(Conversation.uuid);
                        fetchAPI = await (async signal => {
                            Conversation.uuid = randomUUID().toString();
                            Conversation.depth = 0;
                            const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${Config.rProxy || AI.end()}/api/organizations/${uuidOrg}/chat_conversations`, {
                                signal,
                                headers: {
                                    ...AI.hdr(),
                                    Cookie: getCookies()
                                },
                                method: 'POST',
                                body: JSON.stringify({
                                    uuid: Conversation.uuid,
                                    name: ''
                                })
                            });
                            updateParams(res);
                            await checkResErr(res);
                            return res;
                        })(signal);
                        type = 'r';
                    } else if (samePrompt) {} else {
                        const systemExperiment = !Config.Settings.RenewAlways && Config.Settings.SystemExperiments;
                        if (!systemExperiment || systemExperiment && Conversation.depth >= Config.SystemInterval) {
                            type = 'c-r';
                            Conversation.depth = 0;
                        } else {
                            type = 'c-c';
                            Conversation.depth++;
                        }
                    }
                    let {prompt, systems} = ((messages, type) => {
                        const rgxScenario = /^\[Circumstances and context of the dialogue: ([\s\S]+?)\.?\]$/i, rgxPerson = /^\[([\s\S]+?)'s personality: ([\s\S]+?)\]$/i, messagesClone = JSON.parse(JSON.stringify(messages)), realLogs = messagesClone.filter((message => [ 'user', 'assistant' ].includes(message.role))), sampleLogs = messagesClone.filter((message => message.name)), mergedLogs = [ ...sampleLogs, ...realLogs ];
                        mergedLogs.forEach(((message, idx) => {
                            const next = mergedLogs[idx + 1];
                            message.customname = (message => [ 'assistant', 'user' ].includes(message.role) && null != message.name && !(message.name in Replacements))(message);
                            if (next && !Config.Settings.xmlPlot) { //if (next) {
                                if ('name' in message && 'name' in next) {
                                    if (message.name === next.name) {
                                        message.content += '\n' + next.content;
                                        next.merged = true;
                                    }
                                } else if ('system' !== next.role) {
                                    if (next.role === message.role) {
                                        message.content += '\n' + next.content;
                                        next.merged = true;
                                    }
                                } else {
                                    message.content += '\n' + next.content;
                                    next.merged = true;
                                }
                            }
                        }));
                        const lastAssistant = realLogs.findLast((message => !message.merged && 'assistant' === message.role));
                        lastAssistant && Config.Settings.StripAssistant && (lastAssistant.strip = true);
                        const lastUser = realLogs.findLast((message => !message.merged && 'user' === message.role));
                        lastUser && Config.Settings.StripHuman && (lastUser.strip = true);
                        const systemMessages = messagesClone.filter((message => 'system' === message.role && !('name' in message)));
                        systemMessages.forEach(((message, idx) => {
                            const scenario = message.content.match(rgxScenario)?.[1], personality = message.content.match(rgxPerson);
                            if (scenario) {
                                message.content = Config.ScenarioFormat.replace(/{{scenario}}/gim, scenario);
                                message.scenario = true;
                            }
                            if (3 === personality?.length) {
                                message.content = Config.PersonalityFormat.replace(/{{char}}/gim, personality[1]).replace(/{{personality}}/gim, personality[2]);
                                message.personality = true;
                            }
                            message.main = 0 === idx;
                            message.jailbreak = idx === systemMessages.length - 1;
                            ' ' === message.content && (message.discard = true);
                        }));
                        Config.Settings.AllSamples && !Config.Settings.NoSamples && realLogs.forEach((message => {
                            if (![ lastUser, lastAssistant ].includes(message)) {
                                if ('user' === message.role) {
                                    message.name = message.customname ? message.name : 'example_user';
                                    message.role = 'system';
                                } else if ('assistant' === message.role) {
                                    message.name = message.customname ? message.name : 'example_assistant';
                                    message.role = 'system';
                                } else if (!message.customname) {
                                    throw Error('Invalid role ' + message.name);
                                }
                            }
                        }));
                        Config.Settings.NoSamples && !Config.Settings.AllSamples && sampleLogs.forEach((message => {
                            if ('example_user' === message.name) {
                                message.role = 'user';
                            } else if ('example_assistant' === message.name) {
                                message.role = 'assistant';
                            } else if (!message.customname) {
                                throw Error('Invalid role ' + message.name);
                            }
                            message.customname || delete message.name;
                        }));
                        let systems = [];
                        if (![ 'r', 'R', 'api' ].includes(type)) {
                            lastUser.strip = true;
                            systemMessages.forEach((message => message.discard = message.discard || 'c-c' === type ? !message.jailbreak : !message.jailbreak && !message.main));
                            systems = systemMessages.filter((message => !message.discard)).map((message => `"${message.content.substring(0, 25).replace(/\n/g, '\\n').trim()}..."`));
                            messagesClone.forEach((message => message.discard = message.discard || mergedLogs.includes(message) && ![ lastUser ].includes(message)));
                        }
                        const prompt = messagesClone.map(((message, idx) => {
                            if (message.merged || message.discard) {
                                return '';
                            }
                            if (message.content.length < 1) {
                                return message.content;
                            }
                            let spacing = '';
/******************************** */
                            if (Config.Settings.xmlPlot) {
                                idx > 0 && (spacing = '\n\n');
                                const prefix = message.customname ? message.role + ': ' + message.name + ': ' : 'system' !== message.role || message.name ? Replacements[message.name || message.role] + ': ' : 'xmlPlot: ' + Replacements[message.role];
                                return `${spacing}${message.strip ? '' : prefix}${message.content}`;
                            } else {
/******************************** */
                                idx > 0 && (spacing = systemMessages.includes(message) ? '\n' : '\n\n');
                                const prefix = message.customname ? message.name + ': ' : 'system' !== message.role || message.name ? Replacements[message.name || message.role] + ': ' : '' + Replacements[message.role];
                                return `${spacing}${message.strip ? '' : prefix}${'system' === message.role ? message.content : message.content.trim()}`;
                            } //
                        }));
                        return {
                            prompt: prompt.join('').trim(), //genericFixes(prompt.join('')).trim(),
                            systems
                        };
                    })(messages, type);
                    console.log(`${model} [[2m${type}[0m]${!retryRegen && systems.length > 0 ? ' ' + systems.join(' [33m/[0m ') : ''}`); //console.log(`${model} [[2m${type}[0m]${!retryRegen && systems.length > 0 ? ' ' + systems.join(' [33m/[0m ') : ''}`);
                    'R' !== type || prompt || (prompt = '...regen...');
/******************************** */
                    prompt = Config.Settings.xmlPlot ? xmlPlot(prompt, model != AI.mdl()) : apiKey ? `\n\nHuman: ${genericFixes(prompt)}\n\nAssistant: ` : genericFixes(prompt);
                    Config.Settings.FullColon && (prompt = apiKey
                        ? prompt.replace(/(\n\nAssistant|\n\nHuman):/, function(match, p1) {return p1 === '\n\nHuman' ? match : p1 + '：'}).replace(/(\n\nAssistant|\n\nHuman):(?!.*?\n\n(Assistant|Human):)/s, function(match, p1) {return p1 === '\n\nAssistant' ? match : p1 + '：'})
                        : prompt.replace(/(?<=\n\n(H(?:uman)?|A(?:ssistant)?)):[ ]?/g, '： '));
                    Config.Settings.padtxt && (prompt = padtxt(prompt));
/******************************** */
                    Logger?.write(`\n\n-------\n[${(new Date).toLocaleString()}]\n####### ${model} (${type}) ${tokens}t PROMPT:\n${prompt}\n--\n####### REPLY:\n`); //Logger?.write(`\n\n-------\n[${(new Date).toLocaleString()}]\n####### PROMPT (${type}):\n${prompt}\n--\n####### REPLY:\n`);
                    retryRegen || (fetchAPI = await (async (signal, model, prompt, temperature, type) => {
/******************************** */
                        if (apiKey) {
                            const res = await fetch(`${Config.api_rProxy ? Config.api_rProxy : 'https://api.anthropic.com'}/v1/complete`, {
                                method: 'POST',
                                signal,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-api-key': apiKey[Math.floor(Math.random() * apiKey.length)],
                                    'anthropic-version': '2023-06-01'
                                },
                                body: JSON.stringify({
                                    ...stop_sequences && {stop_sequences},
                                    model,
                                    max_tokens_to_sample,
                                    stream: true,
                                    prompt,
                                    temperature
                                }),
                            });
                            await checkResErr(res);
                            return res;
                        }
/******************************** */
                        const attachments = [];
                        if (Config.Settings.PromptExperiments) {
                            let splitedprompt = prompt.split('\n\nPlainPrompt:'); //
                            prompt = splitedprompt[0]; //
                            attachments.push({
                                extracted_content: (prompt),
                                file_name: 'paste.txt',  //fileName(),
                                file_size: Buffer.from(prompt).byteLength,
                                file_type: 'txt'  //'text/plain'
                            });
                            prompt = 'r' === type ? Config.PromptExperimentFirst : Config.PromptExperimentNext;
                            splitedprompt.length > 1 && (prompt += splitedprompt[1]); //
                        }
                        let res;
                        const body = {
                            completion: {
                                ...Config.Settings.PassParams && {
                                    temperature
                                },
                                prompt: prompt || '',
                                timezone: AI.zone(),
                                model: model || AI.mdl()
                            },
                            organization_uuid: uuidOrg,
                            conversation_uuid: Conversation.uuid,
                            text: prompt,
                            attachments
                        };
                        let headers = {
                            ...AI.hdr(Conversation.uuid || ''),
                            Accept: 'text/event-stream',
                            Cookie: getCookies()
                        };
                        res = await (Config.Settings.Superfetch ? Superfetch : fetch)((Config.rProxy || AI.end()) + '/api/append_message', {
                            stream: true,
                            signal,
                            method: 'POST',
                            body: JSON.stringify(body),
                            headers
                        });
                        updateParams(res);
                        await checkResErr(res, CookieChanger); //await checkResErr(res);
                        return res;
                    })(signal, model, prompt, temperature, type));
                    const response = Writable.toWeb(res);
                    clewdStream = new ClewdStream({
                        config: {
                            ...Config,
                            Settings: {
                                ...Config.Settings,
                                Superfetch: apiKey ? false : Config.Settings.Superfetch
                            }
                        }, //config: Config,
                        version: Main,
                        minSize: Config.BufferSize,
                        model,
                        streaming: body.stream,
                        abortControl,
                        source: fetchAPI
                    }, Logger);
                    titleTimer = setInterval((() => setTitle('recv ' + bytesToSize(clewdStream.size))), 300);
                    (!apiKey && Config.Settings.Superfetch) ? await Readable.toWeb(fetchAPI.body).pipeThrough(clewdStream).pipeTo(response) : await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response); //Config.Settings.Superfetch ? await Readable.toWeb(fetchAPI.body).pipeThrough(clewdStream).pipeTo(response) : await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response);
                } catch (err) {
                    if ('AbortError' === err.name) {
                        res.end();
                    } else {
                        err.planned || console.error('[33mClewd:[0m\n%o', err);
                        res.json({
                            error: {
                                message: 'clewd: ' + (err.message || err.name || err.type),
                                type: err.type || err.name || err.code,
                                param: null,
                                code: err.code || 500
                            }
                        });
                    }
                }
                clearInterval(titleTimer);
                if (clewdStream) {
                    clewdStream.censored && console.warn('[33mlikely your account is hard-censored[0m');
                    prevImpersonated = clewdStream.impersonated;
                    setTitle('ok ' + bytesToSize(clewdStream.size));
                    429 == fetchAPI?.status ? console.log(`[35mExceeded limit![0m\n`) : console.log(`${200 == fetchAPI?.status ? '[32m' : '[33m'}${fetchAPI?.status}![0m\n`); //console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m\n`);
                    clewdStream.empty();
                }
                if (!apiKey) { //if (prevImpersonated) {
                    await deleteChat(Conversation.uuid);
/******************************** */
                    changeflag += 1;
                    if (Config.CookieArray?.length > 0 && (429 == fetchAPI?.status || Config.Cookiecounter > 0 && changeflag >= Config.Cookiecounter)) {
                        changeflag = 0;
                        CookieChanger.emit('ChangeCookie');
                    }
/******************************** */
                }
            }));
        })(req, res);
        break;

      case '/v1/complete':
        res.json({
            error: {
                message: 'clewd: Set "Chat Completion" to OpenAI instead of Claude. Enable "External" models aswell'
            }
        });
        break;

      default:
        !['/', '/v1', '/favicon.ico'].includes(req.url) && (console.log('unknown request: ' + req.url)); //console.log('unknown request: ' + req.url);
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(`<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<script>\nfunction copyToClipboard(text) {\n  var textarea = document.createElement("textarea");\n  textarea.textContent = text;\n  textarea.style.position = "fixed";\n  document.body.appendChild(textarea);\n  textarea.select();\n  try {\n    return document.execCommand("copy");\n  } catch (ex) {\n    console.warn("Copy to clipboard failed.", ex);\n    return false;\n  } finally {\n    document.body.removeChild(textarea);\n  }\n}\nfunction copyLink(event) {\n  event.preventDefault();\n  const url = new URL(window.location.href);\n  const link = url.protocol + '//' + url.host + '/v1';\n  copyToClipboard(link);\n  alert('链接已复制: ' + link);\n}\n</script>\n</head>\n<body>\n${Main}<br/><br/>完全开源、免费且禁止商用<br/><br/>点击复制反向代理: <a href="v1" onclick="copyLink(event)">Copy Link</a><br/>填入OpenAI API反向代理并选择OpenAI分类中的claude模型（酒馆需打开Show "External" models，仅在api模式有模型选择差异）<br/><br/>教程与FAQ: <a href="https://rentry.org/teralomaniac_clewd" target="FAQ">Rentry</a> | <a href="https://discord.com/invite/B7Wr25Z7BZ" target="FAQ">Discord</a><br/><br/><br/>请举报恶意盗用/商用本教程及Clewd修改版的这个B 站up<a href="https://space.bilibili.com/35307060" target="FAQ">浅睡一天一夜</a>\n</body>\n</html>`);
        res.end();
        /*res.json(
            {
            error: {
                message: '404 Not Found',
                type: 404,
                param: null,
                code: 404
            }
        }, 404);*/
    }
}));

!async function() {
    await (async () => {
        if (exists(ConfigPath)) {
            const userConfig = require(ConfigPath), validConfigs = Object.keys(Config), parsedConfigs = Object.keys(userConfig), parsedSettings = Object.keys(userConfig.Settings), invalidConfigs = parsedConfigs.filter((config => !validConfigs.includes(config))), validSettings = Object.keys(Config.Settings);
            UnknownSettings = parsedSettings.filter((setting => !validSettings.includes(setting)));
            invalidConfigs.forEach((config => {
                console.warn(`unknown config in config.js: [33m${config}[0m`);
            }));
            UnknownSettings.forEach((setting => {
                console.warn(`unknown setting in config.js: [33mSettings.${setting}[0m`);
            }));
            const missingConfigs = validConfigs.filter((config => !parsedConfigs.includes(config))), missingSettings = validSettings.filter((config => !parsedSettings.includes(config)));
            missingConfigs.forEach((config => {
                console.warn(`adding missing config in config.js: [33m${config}[0m`);
                userConfig[config] = Config[config];
            }));
            missingSettings.forEach((setting => {
                console.warn(`adding missing setting in config.js: [33mSettings.${setting}[0m`);
                userConfig.Settings[setting] = Config.Settings[setting];
            }));
            ChangedSettings = parsedSettings.filter((setting => Config.Settings[setting] !== userConfig.Settings[setting]));
            (missingConfigs.length > 0 || missingSettings.length > 0) && await writeSettings(userConfig);
            userConfig.Settings.LogMessages && (Logger = createWriteStream(LogPath));
            Config = {
                ...Config,
                ...userConfig
            };
        } else {
            Config.Cookie = 'SET YOUR COOKIE HERE';
            writeSettings(Config, true);
        }
    })();
/***************************** */
    for (let key in Config) {
        if (key === 'Settings') {
            for (let setting in Config.Settings) {
                Config.Settings[setting] = process.env[setting] ? convertToType(process.env[setting]) : Config.Settings[setting];
            }
        } else {
            Config[key] = process.env[key] ? convertToType(process.env[key]) : Config[key];
        }
    }
    Config.rProxy = Config.rProxy.replace(/\/$/, '');
    Config.CookieArray = [...new Set([Config.CookieArray].join('').match(/(sessionKey=)?sk-ant-sid01-[\w-]{86}-[\w-]{6}AA/g))];
    writeSettings(Config);
    currentIndex = Config.CookieIndex > 0 ? Config.CookieIndex - 1 : Config.Cookiecounter >= 0 ? Math.floor(Math.random() * Config.CookieArray.length) : 0;
/***************************** */
    Proxy.listen(Config.Port, Config.Ip, onListen);
    Proxy.on('error', (err => {
        console.error('Proxy error\n%o', err);
    }));
}();

const cleanup = async () => {
    console.log('cleaning...');
    try {
        await deleteChat(Conversation.uuid);
        Logger?.close();
    } catch (err) {}
    process.exit();
};

process.on('SIGHUP', cleanup);

process.on('SIGTERM', cleanup);

process.on('SIGINT', cleanup);

process.on('exit', (async () => {
    console.log('exiting...');
}));
