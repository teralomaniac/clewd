/*
* https://rentry.org/teralomaniac_clewd
* https://github.com/teralomaniac/clewd
*/
'use strict';

const {createServer: Server, IncomingMessage, ServerResponse} = require('node:http'), {createHash: Hash, randomUUID, randomInt, randomBytes} = require('node:crypto'), {TransformStream, ReadableStream} = require('node:stream/web'), {Readable, Writable} = require('node:stream'), {Blob} = require('node:buffer'), {existsSync: exists, writeFileSync: write, createWriteStream} = require('node:fs'), {join: joinP} = require('node:path'), {ClewdSuperfetch: Superfetch, SuperfetchAvailable} = require('./lib/clewd-superfetch'), {AI, fileName, genericFixes, bytesToSize, setTitle, checkResErr, Replacements, Main} = require('./lib/clewd-utils'), ClewdStream = require('./lib/clewd-stream');

/******************************************************* */
let currentIndex = 0;

let Firstlogin = true;

const events = require('events');
const CookieChanger = new events.EventEmitter();

CookieChanger.on('ChangeCookie', () => {
    Proxy && Proxy.close();
    console.log('\nChanging Cookie...\n');
    Proxy.listen(Config.Port, Config.Ip, onListen);
    Proxy.on('error', (err => {
        console.error('Proxy error\n%o', err);
    }));
});

const simpletokenizer = (str) => {
    let byteLength = 0;
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code <= 0xFF) {
            byteLength += 0.6;
        } else if (code <= 0xFFFF) {
            byteLength += 1;
        } else {
            byteLength += 1.5;
        }
    }
    return byteLength;
}

const padJson = (json) => {
    if (Config.padtxt_placeholder.length > 0){
        var placeholder = Config.padtxt_placeholder;
    }
    else {
        const bytes = randomInt(5, 15);
        var placeholder = randomBytes(bytes).toString('hex');
    }
    var count = Math.floor((Config.Settings.padtxt - simpletokenizer(json)) / simpletokenizer(placeholder)); 

    // 生成占位符字符串
    var padding = '';
    for (var i = 0; i < count; i++) {
        padding += placeholder;
    }

    // 在json前面添加占位符, 在末尾增加空行然后添加json
    var result = padding + '\n\n\n' + json;

    result = result.replace(/^\s*/, '');

    return result
};

const AddxmlPlot = (content) => {
    // 检查内容中是否包含"<card>","[Start a new"字符串
    if (!content.includes('<card>')) {
        return content;
    }

    content = content.replace(/\[Start a new chat\]/gm, '\n[Start a new chat]');
    content = content.replace(/\n\nSystem:\s*/g, '\n\n');

    // 在第一个"[Start a new"前面加上"<example>"，在最后一个"[Start a new"前面加上"</example>"
    let firstChatStart = content.indexOf('\n\n[Start a new');
    let lastChatStart = content.lastIndexOf('\n\n[Start a new');
    if (firstChatStart != -1) { 
        content = content.slice(0, firstChatStart) + '\n\n</card>\n\n<example>' + 
                content.slice(firstChatStart, lastChatStart) + '\n\n</example>' + 
                content.slice(lastChatStart);
    }
        
    // 之后的第一个"Assistant: "之前插入"\n\n<plot>"
    let lastChatIndex = content.lastIndexOf('\n\n[Start a new');
    if (lastChatIndex != -1 && content.includes('</plot>')) { 
        let assistantIndex = content.indexOf('\n\nAssistant:', lastChatIndex);
        if (assistantIndex != -1) {
            content = content.slice(0, assistantIndex) + '\n\n<plot>' + content.slice(assistantIndex);
        }
    }
  
    let sexMatch = content.match(/\n##.*?\n<(sex|behavior)>[\s\S]*?<\/\1>\n/);
    let processMatch = content.match(/\n##.*?\n<process>[\s\S]*?<\/process>\n/);
  
    if (sexMatch && processMatch) {
        content = content.replace(sexMatch[0], ""); // 移除<sex>部分
        content = content.replace(processMatch[0], sexMatch[0] + processMatch[0]); // 将<sex>部分插入<delete>部分的前面
    }

    let illustrationMatch = content.match(/\n##.*?\n<illustration>[\s\S]*?<\/illustration>\n/);

    if (illustrationMatch && processMatch) {
        content = content.replace(illustrationMatch[0], ""); // 移除<illustration>部分
        content = content.replace(processMatch[0], illustrationMatch[0] + processMatch[0]); // 将<illustration>部分插入<delete>部分的前面
    }

    content = content.replace(/\n\n<(hidden|\/plot)>[\s\S]*?\n\n<extra_prompt>\s*/, '\n\nHuman:'); //sd prompt用

    //消除空XML tags或多余的\n
    content = content.replace(/(?<=\n<(card|hidden|example)>\n)\s*/g, '');
    content = content.replace(/\s*(?=\n<\/(card|hidden|example)>(\n|$))/g, '');
    content = content.replace(/\n<(example|hidden)>\n<\/\1>/g, '');
    content = content.replace(/\n\n\n/g, '\n\n');

    return content
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
    Ip: process.env.PORT ? '0.0.0.0' : '127.0.0.1',
    Port: process.env.PORT || 8444,
    BufferSize: 1,
    SystemInterval: 3,
    rProxy: AI.end(),
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
        PreserveChats: true,
        LogMessages: true,
        FullColon: true,
        padtxt: 13500,
        xmlPlot: true,
        localtunnel: false,
        Superfetch: false
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
    const res = await fetch(`${Config.rProxy}/api/organizations/${uuidOrg}/chat_conversations/${uuid}`, {
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        },
        method: 'DELETE'
    });
    updateParams(res);
}, onListen = async () => {
/***************************** */
    if (Firstlogin) {
        Firstlogin = false;   
        console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
        if (Config.Settings.localtunnel) {
            const localtunnel = require('localtunnel');
            localtunnel({ port: Config.Port })
            .then((tunnel) => {
                console.log(`\nTunnel URL for outer websites: ${tunnel.url}/v1\n`);
            })
        }
    }
    if (Config.CookieArray.length > 0) {
        currentIndex = (currentIndex + 1) % Config.CookieArray.length;
        Config.Cookie = Config.CookieArray[currentIndex];
    }
/***************************** */      
    if ('SET YOUR COOKIE HERE' === Config.Cookie || Config.Cookie?.length < 1) {
        throw Error('Set your cookie inside config.js');
    }
    updateCookies(Config.Cookie);
    //console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
    Config.Settings.Superfetch && SuperfetchAvailable(true);
    const accRes = await fetch(Config.rProxy + '/api/organizations', {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    });
/**************************** */
    if ((accRes.statusText === 'Forbidden') && Config.CookieArray.length > 0){
        Config.CookieArray = Config.CookieArray.filter(item => item !== Config.Cookie);
        writeSettings(Config);
        currentIndex = currentIndex - 1;
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
    console.log('Logged in %o', {
        name: accInfo.name?.split('@')?.[0],
        capabilities: accInfo.capabilities
    });
    uuidOrg = accInfo?.uuid;
    if (accInfo?.active_flags.length > 0) {
        const now = new Date, formattedFlags = accInfo.active_flags.map((flag => {
            const days = ((new Date(flag.expires_at).getTime() - now.getTime()) / 864e5).toFixed(2);
            return {
                type: flag.type,
                remaining_days: days
            };
        }));
        console.warn('[31mYour account has warnings[0m %o', formattedFlags);
        await Promise.all(accInfo.active_flags.map((flag => (async type => {
            if (!Config.Settings.ClearFlags) {
                return;
            }
            if ('consumer_restricted_mode' === type) {
                return;
            }
            const req = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${Config.rProxy}/api/organizations/${uuidOrg}/flags/${type}/dismiss`, {
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
        CookieChanger.emit('ChangeCookie');
/***************************** */
    }
    const convRes = await fetch(`${Config.rProxy}/api/organizations/${uuidOrg}/chat_conversations`, {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    }), conversations = await convRes.json();
    updateParams(convRes);
    conversations.length > 0 && await Promise.all(conversations.map((conv => deleteChat(conv.uuid))));
}, writeSettings = async (config, firstRun = false) => {
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
                id: AI.mdl()
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
                    const model = AI.mdl();
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
                    if (retryRegen) {
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
                            res = await (Config.Settings.Superfetch ? Superfetch : fetch)(Config.rProxy + '/api/retry_message', {
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
                            const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${Config.rProxy}/api/organizations/${uuidOrg}/chat_conversations`, {
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
                            const next = realLogs[idx + 1];
                            message.customname = (message => [ 'assistant', 'user' ].includes(message.role) && null != message.name && !(message.name in Replacements))(message);
                            if (next) {
                                if (message.name && next.name && message.name === next.name) {
                                    message.content += '\n' + next.content;
                                    next.merged = true;
                                } else if (next.role === message.role) {
                                    message.content += '\n' + next.content;
                                    next.merged = true;
                                }
                            }
                        }));
                        const lastAssistant = realLogs.findLast((message => !message.merged && 'assistant' === message.role));
                        lastAssistant && Config.Settings.StripAssistant && (lastAssistant.strip = true);
                        const lastUser = realLogs.findLast((message => !message.merged && 'user' === message.role));
                        lastUser && Config.Settings.StripHuman && (lastUser.strip = true);
                        const systemMessages = messagesClone.filter((message => 'system' === message.role && !message.name));
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
                        if (![ 'r', 'R' ].includes(type)) {
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
                            //idx > 0 && (spacing = systemMessages.includes(message) ? '\n\n' : '\n\n');
                            idx > 0 && (spacing = '\n\n');
                            const prefix = message.customname ? message.name + ': ' : 'system' !== message.role || message.name ? Replacements[message.name || message.role] + ': ' : '' + Replacements[message.role];
                            return `${spacing}${message.strip ? '' : prefix}${'system' === message.role ? message.content : message.content.trim()}`;
                        }));
                        return {
                            prompt: genericFixes(prompt.join('')).trim(),
                            systems
                        };
                    })(messages, type);
                    console.log(`${model} [[2m${type}[0m]${!retryRegen && systems.length > 0 ? ' ' + systems.join(' [33m/[0m ') : ''}`);
                    'R' !== type || prompt || (prompt = '...regen...');
/****************************************************************/
                    Config.Settings.xmlPlot && (prompt = AddxmlPlot(prompt));
                    Config.Settings.FullColon && (prompt = prompt.replace(/(?<=\n\n(H(?:uman)?|A(?:ssistant)?)):[ ]?/g, '：'));
                    Config.Settings.padtxt && (prompt = padJson(prompt));
/****************************************************************/                    
                    Logger?.write(`\n\n-------\n[${(new Date).toLocaleString()}]\n####### PROMPT (${type}):\n${prompt}\n--\n####### REPLY:\n`);
                    retryRegen || (fetchAPI = await (async (signal, model, prompt, temperature, type) => {
                        const attachments = [];
                        if (Config.Settings.PromptExperiments) {
                            attachments.push({
                                extracted_content: (prompt),
                                file_name: 'paste.txt',  //fileName(),
                                file_size: Buffer.from(prompt).byteLength,
                                file_type: 'txt'  //'text/plain'
                            });
                            prompt = 'r' === type ? Config.PromptExperimentFirst : Config.PromptExperimentNext;
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
                        res = await (Config.Settings.Superfetch ? Superfetch : fetch)(Config.rProxy + '/api/append_message', {
                            stream: true,
                            signal,
                            method: 'POST',
                            body: JSON.stringify(body),
                            headers
                        });
                        updateParams(res);
                        await checkResErr(res);
                        return res;
                    })(signal, model, prompt, temperature, type));
                    const response = Writable.toWeb(res);
                    clewdStream = new ClewdStream({
                        config: Config,
                        version: Main,
                        minSize: Config.BufferSize,
                        model,
                        streaming: body.stream,
                        abortControl,
                        source: fetchAPI
                    }, Logger);
                    titleTimer = setInterval((() => setTitle('recv ' + bytesToSize(clewdStream.size))), 300);
                    Config.Settings.Superfetch ? await Readable.toWeb(fetchAPI.body).pipeThrough(clewdStream).pipeTo(response) : await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response);
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
/******************************** */ 
                    if (clewdStream.readonly) {
                        Config.CookieArray = Config.CookieArray.filter(item => item !== Config.Cookie);
                        writeSettings(Config);
                        currentIndex = currentIndex - 1;
                    }
                    clewdStream.cookiechange && CookieChanger.emit('ChangeCookie');
/******************************** */
                    console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m\n`);
                    clewdStream.empty();
                }
                if (prevImpersonated) {
                    try {
                        await deleteChat(Conversation.uuid);
                    } catch (err) {}
                }
            }));
        })(req, res);
        break;

      case '/v1/complete':
        res.json({
            error: {
                message: 'clewd: Set "Chat Completion source" to OpenAI instead of Claude. Enable "External" models aswell'
            }
        });
        break;

      default:
        console.log('unknown request: ' + req.url);
        res.json({
            error: {
                message: '404 Not Found',
                type: 404,
                param: null,
                code: 404
            }
        }, 200);
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
/***************************** */
        for (let key in Config) {
            if (key === 'Settings') {
                for (let setting in Config.Settings) {
                    Config.Settings[setting] = process.env[setting] ?? Config.Settings[setting];
                }
            } else {
                Config[key] = key === 'CookieArray' ? (process.env[key]?.split(',') ?? Config[key]) : (process.env[key] ?? Config[key]);
            }
        }
/***************************** */
    })();
/***************************** */    
    !Config.rProxy && (Config.rProxy = AI.end());
    currentIndex = Math.floor(Math.random() * Config.CookieArray.length);
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
