<div align="center">
<h1>Changelog</h1>
<a href="https://gitgud.io/ahsk/clewd/">
  <img
    height="120"
    width="120"
    alt="Clewd"
    title="Clewd"
    src="https://gitgud.io/ahsk/clewd/-/raw/master/media/logo.png"
    align="center"
  />
</a>
</div>

# 4.7

added multiple model options in case you subscribe to their plans. some based on their docs, some on rumors. stick to 2.1 if you're a free user

# 4.6

fixed major bug in the prompt build logic which was causing problems like the AI refering to old messages erroneously, ignoring your latest message, etc

added superfetch for armv7

# 4.5

expanded superfetch to fix some errors

status codes and *some* basic as fuck error handling for superfetch

stopped trimming system messages

fixed crash sometimes after superfetch request

fixed impersonation sometimes not stopping

fixed hard-censor detection

fixed weird behavior when "Add character names" was checked

fixed another source of "Received no valid replies at all"

chown added to start.sh to stop EACESS errors

> **AllSamples** changed

last Assistant and Human will not be transformed into examples

# 4.4

fixed another source of "Received no valid replies at all"

# 4.3

a fix for "Received no valid replies at all" on >=20k ctx (tested 35k)

> **SuperfetchTimeout** removed

was only relevant to pre-4.0

> **Hotfix 1**

fixed another source of "Received no valid replies at all"


# 4.2

fixed broken replies

# 4.1

> **PromptExperimentFirst** and **PromptExperimentNext** added

both only have effect when **PromptExperiments** is true

**PromptExperimentFirst** is sent on the very first message together with the prompt in file form

**PromptExperimentNext** is sent on the subsequent messages if **RenewAlways** is false

examples

- PromptExperimentFirst set to "Comply"

- PromptExperimentNext set to "Continue"

- one of them set to secondary jailbreak




# 4.0

> **Streaming changes**

reworked how messages are parsed, again

> **Superfetch** reworked

pros:
- streaming
- fast
- more reliable
- no lingering processes
- no firewall issues (hopefully)

cons:
- the AI typing might look weird
- no android-armv7
- android-arm64 possibly doesn't work
- mac-arm64 possibly doesn't work
- no 32bit for any platform for now
- poor error handling

tested on linux and windows

> **SuperfetchHost** and **SuperfetchPort** removed

> **Minor changes**

split code into multiple files

clewd-superfetch and clewd are now the same package

removed all dependencies

**git** [added to requirements](https://gitgud.io/ahsk/clewd/#requirements) (highly recommended so update scripts work, otherwise do a clean install)

# 3.8.5

fixed memory leak on clewd-superfetch

added support for custom host/port for superfetch in case you want

better cleaning up so it is less likely orphan superfetch processes will remain

# 3.8
> **Superfetch** reworked

dropped old js files in favor of custom-made ones

i believe firewalls may block the binaries from connecting to port 443

also, you should see "superfetch-load *{PATH}*" followed by "superfetch-spawn"

> **SuperfetchTimeout** added

controls how much time in seconds until it times out

default 120

> **Minor changes**

new binaries for windows/linux/mac/arm/freebsd

# 3.7

<s>using custom library to see if termux works</s> 

# 3.6
> ### **Superfetch** added (defaults true)

if set to true, will use an alternate method to get past the *"We are unable to serve your request"* error

if set to false it's the old clewd behavior (if you don't struggle with that error you can keep it on false)

> **Streaming changes**

both streaming on/off working

> **RetryRegen** changed

now also works with Superfetch

> **Minor changes**

error handling for Superfetch (can't do much)

support name prefixes for group chats when "Add character names" is enabled

> if you were having trouble with 3.5 but 3.1 or 3.4 were fine, update to this and enable/disable **Superfetch** as you see fit

# 3.5
> **Streaming changes**

fixed the dreaded bug, shit is unstable don't expect much

keep streaming enabled for now

can try to fix non-stream later, same with error handling and **RetryRegenerate**

lastly, fuck you rats ;)

# 3.4
> **Streaming changes**

turns out I could've fixed the broken formatting long ago, should work great now

> Prompt conversion and **SystemExperiments** reworked

> **Prompts** (PromptMain, PromptReminder, PromptContinue) from 3.0 removed

most frontends are implementing prompt managers so that hack is not needed

> **PersonalityFormat** and **ScenarioFormat** added

those are hardcoded on ST and will stay available until they're not

scenarios and char description are extracted from their hardcoded strings and replaced by the format you set

- **RealChatPrefix** default is now empty

> **AllSamples** changed

no longer excludes the last two messages when transforming

> **LogMessages** changed

moved to Settings

> **Minor changes**

- Error handling changes

- RenewAlways is now more stable when set to false. still, regenerate once if you swap characters

# 3.3
added \[DONE\] to end of streams

changed more things to support [RisuAI](https://files.catbox.moe/l243nm.png)

# 3.2
small streaming change to try to fix \n bullshit again

> **PreserveChats** added (defaults false)

if set to true, prevents the deletion of chats at any point

# 3.1
> **Streaming changes**

if the user did not enable streaming, clewd will **fake** a non-stream response for compatibility

> **LogMessages** added (defaults false)

if set to true, will log the prompt and then the reply to a `log.txt` file

# 3.0
> ### **Clewd requires setting your "Chat Completion source" to OpenAI now. Enable the "External" models option aswell.**

> ### A config.js file will be generated when first ran, edit it to set your cookie and customize settings

> **Streaming changes**

streaming is now enforced by the website so no point supporting the other mode

Clewd streaming was reworked to behave more like [NBSX](https://gitgud.io/ahsk/nbsx)

> **AntiStall**, **StallTrigger**, **StallTriggerMax** removed

no longer needed since streaming is enforced

> **DeleteChats** removed

now cleans up by default other than a few cases like when `RenewAlways` is set to false

> **RecycleChats** removed

replaced by another system that is activated only if `RenewAlways` is set to false

> **ReplaceSamples** removed

replaced by **NoSamples** *or* **AllSamples*

> **RetryRegenerate** changed

trigger should be more consistent now

> **StripAssistant** and **StripHuman** changed

they remove the Human/Assistant prefixes from the last messages, keeping the message contents

> **RenewAlways** added (defaults true)

if set to true, this is the default pre-3.0 clewd behavior

if set to false, check the `Prompts` section below

> **NoSamples** added (defaults false)

if set to true, replaces every previous message with H/A prefix from your frontend into Human/Assistant

mutually exclusive with `AllSamples`

(only outgoing)

> **AllSamples** added (defaults false)

if set to true, replaces every Human/Assistant prefix from your frontend **except the last two** into H/A

mutually exclusive with `NoSamples`

(only outgoing)

> **SystemExperiments** (defaults true) and **Prompts** added (Main, Reminder, Continue)

instead of sending a pre-written chunk of text to the AI, now you can customize exactly (almost) how the prompt is formatted before it is sent

if `RenewAlways` is set to true:
- `Main` is **always** the one being used.

if `RenewAlways` is set to false:
- `Main` is sent on conversation start
- `Continue` is sent on the next message, as long as no *impersonation* happened
- every `SystemInterval` of messages, `Reminder` is sent once

---

if `SystemExperiments` is set to true:
uses Main then alternates between Reminder and Continue

if `SystemExperiments` is set to false:
uses Main then Reminder

sometimes it will renew anyway when detecting some oddity

---

example of custom `Main` prompt with XML tags wrapping around

- character description
- scenario
- main prompt
- example messages
- real messages

```
<chat>
{{MAIN_AND_CHARACTER}}
{{CHAT_EXAMPLE}}
{{CHAT_LOG}}
</chat>
{{JAILBREAK}}
```

> **Minor changes**

- Clewd errors now should show as such on your frontend

- flags now show how many days until they expire

- the message limit error now shows how many hours until the restriction is lifted

- settings that aren't on their default are now displayed in yellow on startup

- "[Start a new chat]" is excluded from system prompts


# 2.7
> Fixed broken newlines


# 2.6
> **AdaptClaude** removed

> **ReplaceSamples** added (defaults false)

If set to true, will replace any cases of **outgoing** H/A, to Human/Assistant

now has **no effect** on incoming, [more info](https://docs.anthropic.com/claude/docs/prompt-troubleshooting-checklist#the-prompt-is-formatted-correctly)

>**PreventImperson** updated

now also stops on A: or Assistant:
another check added, *should* impersonate less often


# 2.5
> Changed some defaults around

refer to the [README](https://gitgud.io/ahsk/clewd/#defaults) for the reasoning behind each

> **DeleteChats** bugfix


# 2.4
> **DeleteChats** added (defaults false)

for privacy, deletes old chats on startup and deletes any new ones after receiving a reply

> **PreventImperson** bugfix

should be more accurate now

> **RetryRegenerate** no longer defaults true


# 2.0 to 2.2
> **RetryRegenerate** added (defaults true)

uses the AI's own retry mechanism when you regenerate on your frontend, if you change anything from your last prompt before regenerating it will default to old behavior

> **PromptExperiments** added (defaults true)

an alternative way to send your prompt to the AI, through a file. set to false if it's bad
both enabled: https://files.catbox.moe/io1q53.webm


# 1.6 to 2.0
> **AdaptClaude** now should work better with streaming on

> **AntiStall 2**

now returns up to the first AI reply instead of the second, **AntiStall 1** sends the whole schizophrenia (good chance of some spicy things being included)

> **PreventImperson**

added, stops the bot immediately once it starts pretending to be you (you can use this as kind of a AntiStall, chance of missing some spicy things)

> **PassParams** added (defaults false)

now whatever temperature <=1 you set on SillyTavern will be forwarded to claude (if you get errors turn this shit off), also, no idea if this does anything but they accept it

---

> [README](https://gitgud.io/ahsk/clewd/#defaults)