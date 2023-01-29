# Discord Gateway JS

## Example
```
config.json
```json
{
    "token": "TOKEN",
    "prefix": "!"
}
```
index.js
```js
const { Client, Intents, Collection } = require("./Client");
const fs = require("fs");
const config = require("./config.json");

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.MESSAGE_CONTENT
    ]
});

const eventFiles = fs.readdirSync("./events").filter((file) => file.endsWith(".js"));
for(const file of eventFiles) {
    const event = require(`./events/${file}`);
    const eventName = file.replace(/\.[^.]*$/, "");
    client.on(eventName, (...args) => event(client, ...args));
};

client.commands = new Collection();
const commands = fs.readdirSync("./commands").filter((file) => file.endsWith(".js"));
for (const file of commands) {
    const commandName = file.replace(/\.[^.]*$/, "");
    let command = require(`./commands/${file}`);
    command.name = commandName;
    client.commands.set(commandName, command);
    console.log(`Command loaded: ${commandName}`);
};

client.login(config.token);
