# Discord Gateway JS
Inspired by [discord.js](https://github.com/discordjs/discord.js), this library allows you to connect to an account of a real person and not a robot.

## Example
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
```

# How to get your token
### Press `F12`
![image](https://user-images.githubusercontent.com/93871422/215302448-d383114b-1b6d-4d8d-83c7-9e6b81b365c4.png)
