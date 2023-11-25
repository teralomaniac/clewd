/*
* https://rentry.org/teralomaniac_clewd
* https://github.com/teralomaniac/clewd
*/

// SET YOUR COOKIE BELOW

module.exports = {
    "Cookie": "SET YOUR COOKIE HERE",
    "CookieArray": [],
    "Cookiecounter": -1,
    "CookieIndex": 0,
    "ProxyPassword": "",
    "Ip": "0.0.0.0",
    "Port": 8444,
    "localtunnel": false,
    "BufferSize": 1,
    "SystemInterval": 3,
    "rProxy": "https://claude.ai",
    "padtxt_placeholder": "",
    "PromptExperimentFirst": "",
    "PromptExperimentNext": "",
    "PersonalityFormat": "{{char}}'s personality: {{personality}}",
    "ScenarioFormat": "Dialogue scenario: {{scenario}}",
    "Settings": {
        "RenewAlways": true,
        "RetryRegenerate": false,
        "PromptExperiments": true,
        "SystemExperiments": true,
        "PreventImperson": false,
        "AllSamples": false,
        "NoSamples": false,
        "StripAssistant": false,
        "StripHuman": false,
        "PassParams": false,
        "ClearFlags": true,
        "PreserveChats": false,
        "LogMessages": true,
        "FullColon": true,
        "padtxt": 15000,
        "xmlPlot": true,
        "Superfetch": true
    }
}

/*
 BufferSize
 * How many characters will be buffered before the AI types once
 * lower = less chance of `PreventImperson` working properly

 ---

 SystemInterval
 * How many messages until `SystemExperiments alternates`

 ---

 Other settings
 * https://gitgud.io/ahsk/clewd/#defaults
 * and
 * https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md
 */