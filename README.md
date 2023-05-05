# Discord Gateway JS
Inspired by [Discord.JS](https://github.com/discordjs/discord.js), this library allows you to connect to an account of a real person and not a robot.
To install it, run `npm i axios ws`.

## Example
### config.json
```json
{

}
```
### index.js
```js
const { Client, Intents, Collection } = require("./Client");

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS
    ]
});
client.prefix = "!";

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
    if (message.author.bot) return;
    if (!message.content?.startsWith(client.prefix)) return;
    const args = message.content.slice(client.prefix.length).trim().split(/ +/g);
    const commandName = args.shift().toLowerCase();
    switch (commandName) {
        case "ping": {
            message.reply({
                content: "📡 Ping..."
            }).then((msg) => {
                msg.edit({
                    content: `🏓 Pong ${msg.createdTimestamp-message.createdTimestamp}ms.`
                });
            }).catch(() => {});
        }; break;
    };
});

client.login("YOUR_EMAIL", "YOUR_PASSWORD");
```
