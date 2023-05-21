const { WebSocket } = require("ws");
const { EventEmitter } = require("events");
const axios = require("axios");

const utils = {
    resolveColor(color) {
        if (typeof color === "string") {
            if (color === "RANDOM") return Math.floor(Math.random() * (0xffffff + 1));
            if (color === "DEFAULT") return 0;
            color = Colors[color] ?? parseInt(color.replace("#", ""), 16);
        } else if (Array.isArray(color)) {
            color = (color[0] << 16) + (color[1] << 8) + color[2];
        };

        if (color < 0 || color > 0xffffff) throw new Error("COLOR_RANGE");
        else if (Number.isNaN(color)) throw new Error("COLOR_CONVERT");

        return color;
    },

    cloneObject(obj) {
        return Object.assign(Object.create(obj), obj);
    },

    verifyString(
        data,
        errorMessage = `Expected a string, got ${data} instead.`,
        allowEmpty = true,
    ) {
        if (typeof data !== "string") throw new Error(errorMessage);
        if (!allowEmpty && data.length === 0) throw new Error(errorMessage);
        return data;
    }
};

class Collection extends Map {
    constructor(entries) {
        super(entries);
        /**
         * Cached array for the `array()` method - will be reset to `null` whenever `set()` or `delete()` are called
         * @name Collection#_array
         * @type {?Array}
         * @private
         */
        Object.defineProperty(this, "_array", { value: null, writable: true, configurable: true });
        /**
         * Cached array for the `keyArray()` method - will be reset to `null` whenever `set()` or `delete()` are called
         * @name Collection#_keyArray
         * @type {?Array}
         * @private
         */
        Object.defineProperty(this, "_keyArray", { value: null, writable: true, configurable: true });
    }
    /**
     * Identical to [Map.get()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get).
     * Gets an element with the specified key, and returns its value, or `undefined` if the element does not exist.
     * @param {*} key - The key to get from this collection
     * @returns {* | undefined}
     */
    get(key) {
        return super.get(key);
    }
    /**
     * Identical to [Map.set()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set).
     * Sets a new element in the collection with the specified key and value.
     * @param {*} key - The key of the element to add
     * @param {*} value - The value of the element to add
     * @returns {Collection}
     */
    set(key, value) {
        this._array = null;
        this._keyArray = null;
        return super.set(key, value);
    }
    /**
     * Identical to [Map.has()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has).
     * Checks if an element exists in the collection.
     * @param {*} key - The key of the element to check for
     * @returns {boolean} `true` if the element exists, `false` if it does not exist.
     */
    has(key) {
        return super.has(key);
    }
    /**
     * Identical to [Map.delete()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete).
     * Deletes an element from the collection.
     * @param {*} key - The key to delete from the collection
     * @returns {boolean} `true` if the element was removed, `false` if the element does not exist.
     */
    delete(key) {
        this._array = null;
        this._keyArray = null;
        return super.delete(key);
    }
    /**
     * Identical to [Map.clear()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/clear).
     * Removes all elements from the collection.
     * @returns {undefined}
     */
    clear() {
        return super.clear();
    }
    /**
     * Creates an ordered array of the values of this collection, and caches it internally. The array will only be
     * reconstructed if an item is added to or removed from the collection, or if you change the length of the array
     * itself. If you don"t want this caching behavior, use `[...collection.values()]` or
     * `Array.from(collection.values())` instead.
     * @returns {Array}
     */
    array() {
        if (!this._array || this._array.length !== this.size) this._array = [...this.values()];
        return this._array;
    }
    /**
     * Creates an ordered array of the keys of this collection, and caches it internally. The array will only be
     * reconstructed if an item is added to or removed from the collection, or if you change the length of the array
     * itself. If you don"t want this caching behavior, use `[...collection.keys()]` or
     * `Array.from(collection.keys())` instead.
     * @returns {Array}
     */
    keyArray() {
        if (!this._keyArray || this._keyArray.length !== this.size) this._keyArray = [...this.keys()];
        return this._keyArray;
    }
    first(amount) {
        if (typeof amount === "undefined") return this.values().next().value;
        if (amount < 0) return this.last(amount * -1);
        amount = Math.min(this.size, amount);
        const iter = this.values();
        return Array.from({ length: amount }, () => iter.next().value);
    }
    firstKey(amount) {
        if (typeof amount === "undefined") return this.keys().next().value;
        if (amount < 0) return this.lastKey(amount * -1);
        amount = Math.min(this.size, amount);
        const iter = this.keys();
        return Array.from({ length: amount }, () => iter.next().value);
    }
    last(amount) {
        const arr = this.array();
        if (typeof amount === "undefined") return arr[arr.length - 1];
        if (amount < 0) return this.first(amount * -1);
        if (!amount) return [];
        return arr.slice(-amount);
    }
    lastKey(amount) {
        const arr = this.keyArray();
        if (typeof amount === "undefined") return arr[arr.length - 1];
        if (amount < 0) return this.firstKey(amount * -1);
        if (!amount) return [];
        return arr.slice(-amount);
    }
    random(amount) {
        let arr = this.array();
        if (typeof amount === "undefined") return arr[Math.floor(Math.random() * arr.length)];
        if (arr.length === 0 || !amount) return [];
        arr = arr.slice();
        return Array.from({ length: amount }, () => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }
    randomKey(amount) {
        let arr = this.keyArray();
        if (typeof amount === "undefined") return arr[Math.floor(Math.random() * arr.length)];
        if (arr.length === 0 || !amount) return [];
        arr = arr.slice();
        return Array.from({ length: amount }, () => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }
    find(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        for (const [key, val] of this) {
            if (fn(val, key, this)) return val;
        }
        return undefined;
    }
    findKey(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        for (const [key, val] of this) {
            if (fn(val, key, this)) return key;
        }
        return undefined;
    }
    sweep(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        const previousSize = this.size;
        for (const [key, val] of this) {
            if (fn(val, key, this)) this.delete(key);
        }
        return previousSize - this.size;
    }
    filter(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        const results = new this.constructor[Symbol.species]();
        for (const [key, val] of this) {
            if (fn(val, key, this)) results.set(key, val);
        }
        return results;
    }
    partition(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        // TODO: consider removing the <K, V> from the constructors after TS 3.7.0 is released, as it infers it
        const results = [new this.constructor[Symbol.species](), new this.constructor[Symbol.species]()];
        for (const [key, val] of this) {
            if (fn(val, key, this)) {
                results[0].set(key, val);
            } else {
                results[1].set(key, val);
            }
        }
        return results;
    }
    flatMap(fn, thisArg) {
        const collections = this.map(fn, thisArg);
        return new this.constructor[Symbol.species]().concat(...collections);
    }
    map(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        const iter = this.entries();
        return Array.from({ length: this.size }, () => {
            const [key, value] = iter.next().value;
            return fn(value, key, this);
        });
    }
    mapValues(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        const coll = new this.constructor[Symbol.species]();
        for (const [key, val] of this) coll.set(key, fn(val, key, this));
        return coll;
    }
    some(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        for (const [key, val] of this) {
            if (fn(val, key, this)) return true;
        }
        return false;
    }
    every(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        for (const [key, val] of this) {
            if (!fn(val, key, this)) return false;
        }
        return true;
    }
    /**
     * Applies a function to produce a single value. Identical in behavior to
     * [Array.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce).
     * @param {Function} fn Function used to reduce, taking four arguments; `accumulator`, `currentValue`, `currentKey`,
     * and `collection`
     * @param {*} [initialValue] Starting value for the accumulator
     * @returns {*}
     * @example collection.reduce((acc, guild) => acc + guild.memberCount, 0);
     */
    reduce(fn, initialValue) {
        let accumulator;
        if (typeof initialValue !== "undefined") {
            accumulator = initialValue;
            for (const [key, val] of this) accumulator = fn(accumulator, val, key, this);
            return accumulator;
        }
        let first = true;
        for (const [key, val] of this) {
            if (first) {
                accumulator = val;
                first = false;
                continue;
            }
            accumulator = fn(accumulator, val, key, this);
        }
        // No items iterated.
        if (first) {
            throw new TypeError("Reduce of empty collection with no initial value");
        }
        return accumulator;
    }
    each(fn, thisArg) {
        this.forEach(fn, thisArg);
        return this;
    }
    tap(fn, thisArg) {
        if (typeof thisArg !== "undefined") fn = fn.bind(thisArg);
        fn(this);
        return this;
    }
    /**
     * Creates an identical shallow copy of this collection.
     * @returns {Collection}
     * @example const newColl = someColl.clone();
     */
    clone() {
        return new this.constructor[Symbol.species](this);
    }
    /**
     * Combines this collection with others into a new collection. None of the source collections are modified.
     * @param {...Collection} collections Collections to merge
     * @returns {Collection}
     * @example const newColl = someColl.concat(someOtherColl, anotherColl, ohBoyAColl);
     */
    concat(...collections) {
        const newColl = this.clone();
        for (const coll of collections) {
            for (const [key, val] of coll) newColl.set(key, val);
        }
        return newColl;
    }
    /**
     * Checks if this collection shares identical items with another.
     * This is different to checking for equality using equal-signs, because
     * the collections may be different objects, but contain the same data.
     * @param {Collection} collection Collection to compare with
     * @returns {boolean} Whether the collections have identical contents
     */
    equals(collection) {
        if (!collection) return false;
        if (this === collection) return true;
        if (this.size !== collection.size) return false;
        for (const [key, value] of this) {
            if (!collection.has(key) || value !== collection.get(key)) {
                return false;
            }
        }
        return true;
    }
    /**
     * The sort method sorts the items of a collection in place and returns it.
     * The sort is not necessarily stable in Node 10 or older.
     * The default sort order is according to string Unicode code points.
     * @param {Function} [compareFunction] Specifies a function that defines the sort order.
     * If omitted, the collection is sorted according to each character"s Unicode code point value,
     * according to the string conversion of each element.
     * @returns {Collection}
     * @example collection.sort((userA, userB) => userA.createdTimestamp - userB.createdTimestamp);
     */
    sort(compareFunction = (x, y) => Number(x > y) || Number(x === y) - 1) {
        const entries = [...this.entries()];
        entries.sort((a, b) => compareFunction(a[1], b[1], a[0], b[0]));
        // Perform clean-up
        super.clear();
        this._array = null;
        this._keyArray = null;
        // Set the new entries
        for (const [k, v] of entries) {
            super.set(k, v);
        }
        return this;
    }
    /**
     * The intersect method returns a new structure containing items where the keys are present in both original structures.
     * @param {Collection} other The other Collection to filter against
     * @returns {Collection}
     */
    intersect(other) {
        return other.filter((_, k) => this.has(k));
    }
    /**
     * The difference method returns a new structure containing items where the key is present in one of the original structures but not the other.
     * @param {Collection} other The other Collection to filter against
     * @returns {Collection}
     */
    difference(other) {
        return other.filter((_, k) => !this.has(k)).concat(this.filter((_, k) => !other.has(k)));
    }
    /**
     * The sorted method sorts the items of a collection and returns it.
     * The sort is not necessarily stable in Node 10 or older.
     * The default sort order is according to string Unicode code points.
     * @param {Function} [compareFunction] Specifies a function that defines the sort order.
     * If omitted, the collection is sorted according to each character"s Unicode code point value,
     * according to the string conversion of each element.
     * @returns {Collection}
     * @example collection.sorted((userA, userB) => userA.createdTimestamp - userB.createdTimestamp);
     */
    sorted(compareFunction = (x, y) => Number(x > y) || Number(x === y) - 1) {
        return new this.constructor[Symbol.species]([...this.entries()]).sort((av, bv, ak, bk) => compareFunction(av, bv, ak, bk));
    }
};

class BitField {
    /**
     * @param {BitFieldResolvable} [bits=this.constructor.defaultBit] Bit(s) to read from
     */
    constructor(bits = this.constructor.defaultBit) {
        /**
         * Bitfield of the packed bits
         * @type {number|bigint}
         */
        this.bitfield = this.constructor.resolve(bits);
    }

    /**
     * Checks whether the bitfield has a bit, or any of multiple bits.
     * @param {BitFieldResolvable} bit Bit(s) to check for
     * @returns {boolean}
     */
    any(bit) {
        return (this.bitfield & this.constructor.resolve(bit)) !== this.constructor.defaultBit;
    }

    /**
     * Checks if this bitfield equals another
     * @param {BitFieldResolvable} bit Bit(s) to check for
     * @returns {boolean}
     */
    equals(bit) {
        return this.bitfield === this.constructor.resolve(bit);
    }

    /**
     * Checks whether the bitfield has a bit, or multiple bits.
     * @param {BitFieldResolvable} bit Bit(s) to check for
     * @returns {boolean}
     */
    has(bit) {
        bit = this.constructor.resolve(bit);
        return (this.bitfield & bit) === bit;
    }

    /**
     * Gets all given bits that are missing from the bitfield.
     * @param {BitFieldResolvable} bits Bit(s) to check for
     * @param {...*} hasParams Additional parameters for the has method, if any
     * @returns {string[]}
     */
    missing(bits, ...hasParams) {
        return new this.constructor(bits).remove(this).toArray(...hasParams);
    }

    /**
     * Freezes these bits, making them immutable.
     * @returns {Readonly<BitField>}
     */
    freeze() {
        return Object.freeze(this);
    }

    /**
     * Adds bits to these ones.
     * @param {...BitFieldResolvable} [bits] Bits to add
     * @returns {BitField} These bits or new BitField if the instance is frozen.
     */
    add(...bits) {
        let total = this.constructor.defaultBit;
        for (const bit of bits) {
            total |= this.constructor.resolve(bit);
        }
        if (Object.isFrozen(this)) return new this.constructor(this.bitfield | total);
        this.bitfield |= total;
        return this;
    }

    /**
     * Removes bits from these.
     * @param {...BitFieldResolvable} [bits] Bits to remove
     * @returns {BitField} These bits or new BitField if the instance is frozen.
     */
    remove(...bits) {
        let total = this.constructor.defaultBit;
        for (const bit of bits) {
            total |= this.constructor.resolve(bit);
        }
        if (Object.isFrozen(this)) return new this.constructor(this.bitfield & ~total);
        this.bitfield &= ~total;
        return this;
    }

    /**
     * Gets an object mapping field names to a {@link boolean} indicating whether the
     * bit is available.
     * @param {...*} hasParams Additional parameters for the has method, if any
     * @returns {Object}
     */
    serialize(...hasParams) {
        const serialized = {};
        for (const [flag, bit] of Object.entries(this.constructor.FLAGS)) serialized[flag] = this.has(bit, ...hasParams);
        return serialized;
    }

    /**
     * Gets an {@link Array} of bitfield names based on the bits available.
     * @param {...*} hasParams Additional parameters for the has method, if any
     * @returns {string[]}
     */
    toArray(...hasParams) {
        return Object.keys(this.constructor.FLAGS).filter(bit => this.has(bit, ...hasParams));
    }

    toJSON() {
        return typeof this.bitfield === "number" ? this.bitfield : this.bitfield.toString();
    }

    valueOf() {
        return this.bitfield;
    }

    *[Symbol.iterator]() {
        yield* this.toArray();
    }

    /**
     * Data that can be resolved to give a bitfield. This can be:
     * * A bit number (this can be a number literal or a value taken from {@link BitField.FLAGS})
     * * A string bit number
     * * An instance of BitField
     * * An Array of BitFieldResolvable
     * @typedef {number|string|bigint|BitField|BitFieldResolvable[]} BitFieldResolvable
     */

    /**
     * Resolves bitfields to their numeric form.
     * @param {BitFieldResolvable} [bit] bit(s) to resolve
     * @returns {number|bigint}
     */
    static resolve(bit) {
        const { defaultBit } = this;
        if (typeof defaultBit === typeof bit && bit >= defaultBit) return bit;
        if (bit instanceof BitField) return bit.bitfield;
        if (Array.isArray(bit)) return bit.map(p => this.resolve(p)).reduce((prev, p) => prev | p, defaultBit);
        if (typeof bit === "string") {
            if (typeof this.FLAGS[bit] !== "undefined") return this.FLAGS[bit];
            if (!isNaN(bit)) return typeof defaultBit === "bigint" ? BigInt(bit) : Number(bit);
        };
        throw new Error("BITFIELD_INVALID", bit);
    }

    /**
     * Numeric bitfield flags.
     * <info>Defined in extension classes</info>
     * @type {Object}
     * @abstract
     */
    static FLAGS = {};

    /**
     * @type {number|bigint}
     * @private
     */
    static defaultBit = 0;
}

class Intents extends BitField {
    /**
     * Numeric WebSocket intents. All available properties:
     * * `GUILDS`
     * * `GUILD_MEMBERS`
     * * `GUILD_BANS`
     * * `GUILD_EMOJIS_AND_STICKERS`
     * * `GUILD_INTEGRATIONS`
     * * `GUILD_WEBHOOKS`
     * * `GUILD_INVITES`
     * * `GUILD_VOICE_STATES`
     * * `GUILD_PRESENCES`
     * * `GUILD_MESSAGES`
     * * `GUILD_MESSAGE_REACTIONS`
     * * `GUILD_MESSAGE_TYPING`
     * * `DIRECT_MESSAGES`
     * * `DIRECT_MESSAGE_REACTIONS`
     * * `DIRECT_MESSAGE_TYPING`
     * * `MESSAGE_CONTENT`
     * * `GUILD_SCHEDULED_EVENTS`
     * @type {Object}
     * @see {@link https://discord.com/developers/docs/topics/gateway#list-of-intents}
     */
    static FLAGS = {
        GUILDS: 1 << 0,
        GUILD_MEMBERS: 1 << 1,
        GUILD_BANS: 1 << 2,
        GUILD_EMOJIS_AND_STICKERS: 1 << 3,
        GUILD_INTEGRATIONS: 1 << 4,
        GUILD_WEBHOOKS: 1 << 5,
        GUILD_INVITES: 1 << 6,
        GUILD_VOICE_STATES: 1 << 7,
        GUILD_PRESENCES: 1 << 8,
        GUILD_MESSAGES: 1 << 9,
        GUILD_MESSAGE_REACTIONS: 1 << 10,
        GUILD_MESSAGE_TYPING: 1 << 11,
        DIRECT_MESSAGES: 1 << 12,
        DIRECT_MESSAGE_REACTIONS: 1 << 13,
        DIRECT_MESSAGE_TYPING: 1 << 14,
        MESSAGE_CONTENT: 1 << 15,
        GUILD_SCHEDULED_EVENTS: 1 << 16,
    }
}

class User {
    /**
     * https://discord.com/developers/docs/resources/user#user-object-user-structure
     */
    constructor(data, client) {
        this.client = client;
        this.id = data.id;
        this.username = data.username;
        this.discriminator = data.discriminator;
        this.avatar = data.avatar;
        this.bot = data.bot || false;
        this.system = data.system || false;
        this.banner = data.banner;
        this.accent_color = data.accent_color;
        this.locale = data.locale;
        this.publicFlags = data.public_flags;
        this.flags = new BitField(data.public_flags);
        this.tag = `${data.username}#${data.discriminator}`;
        this.defaultAvatar = data.discriminator % 5;
    }

    avatarURL({ format, size } = {}) {
        if (this.avatar) {
            const url = new URL(`https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}${format ? "." + format : ""}`);
            if (size) url.searchParams.append("size", size);
            return url;
        } else {
            return `https://cdn.discordapp.com/embed/avatars/${this.default_avatar}.png`;
        };
    }

    bannerURL({ format, size } = {}) {
        if (!this.banner) return null;
        const url = new URL(`https://cdn.discordapp.com/banners/${this.id}/${this.banner}${format ? "." + format : ""}`);
        if (size) url.searchParams.append("size", size);
        return url;
    }

    /**
     * Numeric user flags. All available properties:
     * * `DISCORD_EMPLOYEE`
     * * `PARTNERED_SERVER_OWNER`
     * * `HYPESQUAD_EVENTS`
     * * `BUGHUNTER_LEVEL_1`
     * * `HOUSE_BRAVERY`
     * * `HOUSE_BRILLIANCE`
     * * `HOUSE_BALANCE`
     * * `EARLY_SUPPORTER`
     * * `TEAM_USER`
     * * `BUGHUNTER_LEVEL_2`
     * * `VERIFIED_BOT`
     * * `EARLY_VERIFIED_BOT_DEVELOPER`
     * * `DISCORD_CERTIFIED_MODERATOR`
     * * `BOT_HTTP_INTERACTIONS`
     * @type {Object}
     * @see {@link https://discord.com/developers/docs/resources/user#user-object-user-flags}
     */
    static FLAGS = {
        DISCORD_EMPLOYEE: 1 << 0,
        PARTNERED_SERVER_OWNER: 1 << 1,
        HYPESQUAD_EVENTS: 1 << 2,
        BUGHUNTER_LEVEL_1: 1 << 3,
        HOUSE_BRAVERY: 1 << 6,
        HOUSE_BRILLIANCE: 1 << 7,
        HOUSE_BALANCE: 1 << 8,
        EARLY_SUPPORTER: 1 << 9,
        TEAM_USER: 1 << 10,
        BUGHUNTER_LEVEL_2: 1 << 14,
        VERIFIED_BOT: 1 << 16,
        EARLY_VERIFIED_BOT_DEVELOPER: 1 << 17,
        DISCORD_CERTIFIED_MODERATOR: 1 << 18,
        BOT_HTTP_INTERACTIONS: 1 << 19
    }
};

class MessageAttachment {
    constructor(attachment, name = null, data) {
        this.attachment = attachment;
        this.id = data.id;
        this.name = name;
        this.description = data?.description || null;
        this.content_type = data?.content_type || null;
        if (data?.size) this.size = data.size;
        if (data?.url) this.url = data.url;
        if (data?.proxy_url) this.proxy_url = data.proxy_url;
        this.height = data?.height || null;
        this.width = data?.width || null;
        this.ephemeral = data?.ephemeral || false;
    }

    /**
     * @external APIAttachment
     * @see {@link https://discord.com/developers/docs/resources/channel#attachment-object}
     */
};

class MessageEmbed {
    /**
     * A `Partial` object is a representation of any existing object.
     * This object contains between 0 and all of the original objects parameters.
     * This is true regardless of whether the parameters are optional in the base object.
     * @typedef {Object} Partial
     */

    /**
     * Represents the possible options for a MessageEmbed
     * @typedef {Object} MessageEmbedOptions
     * @property {string} [title] The title of this embed
     * @property {string} [description] The description of this embed
     * @property {string} [url] The URL of this embed
     * @property {Date|number} [timestamp] The timestamp of this embed
     * @property {ColorResolvable} [color] The color of this embed
     * @property {EmbedFieldData[]} [fields] The fields of this embed
     * @property {Partial<MessageEmbedAuthor>} [author] The author of this embed
     * @property {Partial<MessageEmbedThumbnail>} [thumbnail] The thumbnail of this embed
     * @property {Partial<MessageEmbedImage>} [image] The image of this embed
     * @property {Partial<MessageEmbedVideo>} [video] The video of this embed
     * @property {Partial<MessageEmbedFooter>} [footer] The footer of this embed
     */

    // eslint-disable-next-line valid-jsdoc
    /**
     * @param {MessageEmbed|MessageEmbedOptions|APIEmbed} [data={}] MessageEmbed to clone or raw embed data
     */
    constructor(data = {}, skipValidation = false) {
        this.setup(data, skipValidation);
    }

    setup(data, skipValidation) {
        /**
         * The type of this embed, either:
         * * `rich` - a generic embed rendered from embed attributes
         * * `image` - an image embed
         * * `video` - a video embed
         * * `gifv` - an animated gif image embed rendered as a video embed
         * * `article` - an article embed
         * * `link` - a link embed
         * @type {string}
         * @see {@link https://discord.com/developers/docs/resources/channel#embed-object-embed-types}
         * @deprecated
         */
        this.type = data.type ?? "rich";

        /**
         * The title of this embed
         * @type {?string}
         */
        this.title = data.title ?? null;

        /**
         * The description of this embed
         * @type {?string}
         */
        this.description = data.description ?? null;

        /**
         * The URL of this embed
         * @type {?string}
         */
        this.url = data.url ?? null;

        /**
         * The color of this embed
         * @type {?number}
         */
        this.color = "color" in data ? utils.resolveColor(data.color) : null;

        /**
         * The timestamp of this embed
         * @type {?number}
         */
        this.timestamp = "timestamp" in data ? new Date(data.timestamp).getTime() : null;

        /**
         * Represents a field of a MessageEmbed
         * @typedef {Object} EmbedField
         * @property {string} name The name of this field
         * @property {string} value The value of this field
         * @property {boolean} inline If this field will be displayed inline
         */

        /**
         * The fields of this embed
         * @type {EmbedField[]}
         */
        this.fields = [];
        if (data.fields) {
            this.fields = skipValidation ? data.fields.map(utils.cloneObject) : this.constructor.normalizeFields(data.fields);
        }

        /**
         * Represents the thumbnail of a MessageEmbed
         * @typedef {Object} MessageEmbedThumbnail
         * @property {string} url URL for this thumbnail
         * @property {string} proxyURL ProxyURL for this thumbnail
         * @property {number} height Height of this thumbnail
         * @property {number} width Width of this thumbnail
         */

        /**
         * The thumbnail of this embed (if there is one)
         * @type {?MessageEmbedThumbnail}
         */
        this.thumbnail = data.thumbnail
            ? {
                url: data.thumbnail.url,
                proxyURL: data.thumbnail.proxyURL ?? data.thumbnail.proxy_url,
                height: data.thumbnail.height,
                width: data.thumbnail.width,
            }
            : null;

        /**
         * Represents the image of a MessageEmbed
         * @typedef {Object} MessageEmbedImage
         * @property {string} url URL for this image
         * @property {string} proxyURL ProxyURL for this image
         * @property {number} height Height of this image
         * @property {number} width Width of this image
         */

        /**
         * The image of this embed, if there is one
         * @type {?MessageEmbedImage}
         */
        this.image = data.image
            ? {
                url: data.image.url,
                proxyURL: data.image.proxyURL ?? data.image.proxy_url,
                height: data.image.height,
                width: data.image.width,
            }
            : null;

        /**
         * Represents the video of a MessageEmbed
         * @typedef {Object} MessageEmbedVideo
         * @property {string} url URL of this video
         * @property {string} proxyURL ProxyURL for this video
         * @property {number} height Height of this video
         * @property {number} width Width of this video
         */

        /**
         * The video of this embed (if there is one)
         * @type {?MessageEmbedVideo}
         * @readonly
         */
        this.video = data.video
            ? {
                url: data.video.url,
                proxyURL: data.video.proxyURL ?? data.video.proxy_url,
                height: data.video.height,
                width: data.video.width,
            }
            : null;

        /**
         * Represents the author field of a MessageEmbed
         * @typedef {Object} MessageEmbedAuthor
         * @property {string} name The name of this author
         * @property {string} url URL of this author
         * @property {string} iconURL URL of the icon for this author
         * @property {string} proxyIconURL Proxied URL of the icon for this author
         */

        /**
         * The author of this embed (if there is one)
         * @type {?MessageEmbedAuthor}
         */
        this.author = data.author
            ? {
                name: data.author.name,
                url: data.author.url,
                iconURL: data.author.iconURL ?? data.author.icon_url,
                proxyIconURL: data.author.proxyIconURL ?? data.author.proxy_icon_url,
            }
            : null;

        /**
         * Represents the provider of a MessageEmbed
         * @typedef {Object} MessageEmbedProvider
         * @property {string} name The name of this provider
         * @property {string} url URL of this provider
         */

        /**
         * The provider of this embed (if there is one)
         * @type {?MessageEmbedProvider}
         */
        this.provider = data.provider
            ? {
                name: data.provider.name,
                url: data.provider.url,
            }
            : null;

        /**
         * Represents the footer field of a MessageEmbed
         * @typedef {Object} MessageEmbedFooter
         * @property {string} text The text of this footer
         * @property {string} iconURL URL of the icon for this footer
         * @property {string} proxyIconURL Proxied URL of the icon for this footer
         */

        /**
         * The footer of this embed
         * @type {?MessageEmbedFooter}
         */
        this.footer = data.footer
            ? {
                text: data.footer.text,
                iconURL: data.footer.iconURL ?? data.footer.icon_url,
                proxyIconURL: data.footer.proxyIconURL ?? data.footer.proxy_icon_url,
            }
            : null;
    }

    /**
     * The date displayed on this embed
     * @type {?Date}
     * @readonly
     */
    get createdAt() {
        return this.timestamp ? new Date(this.timestamp) : null;
    }

    /**
     * The hexadecimal version of the embed color, with a leading hash
     * @type {?string}
     * @readonly
     */
    get hexColor() {
        return this.color ? `#${this.color.toString(16).padStart(6, "0")}` : null;
    }

    /**
     * The accumulated length for the embed title, description, fields, footer text, and author name
     * @type {number}
     * @readonly
     */
    get length() {
        return (
            (this.title?.length ?? 0) +
            (this.description?.length ?? 0) +
            (this.fields.length >= 1
                ? this.fields.reduce((prev, curr) => prev + curr.name.length + curr.value.length, 0)
                : 0) +
            (this.footer?.text.length ?? 0) +
            (this.author?.name.length ?? 0)
        );
    }

    /**
     * Checks if this embed is equal to another one by comparing every single one of their properties.
     * @param {MessageEmbed|APIEmbed} embed The embed to compare with
     * @returns {boolean}
     */
    equals(embed) {
        return (
            this.type === embed.type &&
            this.author?.name === embed.author?.name &&
            this.author?.url === embed.author?.url &&
            this.author?.iconURL === (embed.author?.iconURL ?? embed.author?.icon_url) &&
            this.color === embed.color &&
            this.title === embed.title &&
            this.description === embed.description &&
            this.url === embed.url &&
            this.timestamp === embed.timestamp &&
            this.fields.length === embed.fields.length &&
            this.fields.every((field, i) => this._fieldEquals(field, embed.fields[i])) &&
            this.footer?.text === embed.footer?.text &&
            this.footer?.iconURL === (embed.footer?.iconURL ?? embed.footer?.icon_url) &&
            this.image?.url === embed.image?.url &&
            this.thumbnail?.url === embed.thumbnail?.url &&
            this.video?.url === embed.video?.url &&
            this.provider?.name === embed.provider?.name &&
            this.provider?.url === embed.provider?.url
        );
    }

    /**
     * Compares two given embed fields to see if they are equal
     * @param {EmbedFieldData} field The first field to compare
     * @param {EmbedFieldData} other The second field to compare
     * @returns {boolean}
     * @private
     */
    _fieldEquals(field, other) {
        return field.name === other.name && field.value === other.value && field.inline === other.inline;
    }

    /**
     * Adds a field to the embed (max 25).
     * @param {string} name The name of this field
     * @param {string} value The value of this field
     * @param {boolean} [inline=false] If this field will be displayed inline
     * @returns {MessageEmbed}
     * @deprecated This method is a wrapper for {@link MessageEmbed#addFields}. Use that instead.
     */
    addField(name, value, inline) {
        return this.addFields({ name, value, inline });
    }

    /**
     * Adds fields to the embed (max 25).
     * @param {...EmbedFieldData|EmbedFieldData[]} fields The fields to add
     * @returns {MessageEmbed}
     */
    addFields(...fields) {
        this.fields.push(...this.constructor.normalizeFields(fields));
        return this;
    }

    /**
     * Removes, replaces, and inserts fields in the embed (max 25).
     * @param {number} index The index to start at
     * @param {number} deleteCount The number of fields to remove
     * @param {...EmbedFieldData|EmbedFieldData[]} [fields] The replacing field objects
     * @returns {MessageEmbed}
     */
    spliceFields(index, deleteCount, ...fields) {
        this.fields.splice(index, deleteCount, ...this.constructor.normalizeFields(...fields));
        return this;
    }

    /**
     * Sets the embed"s fields (max 25).
     * @param {...EmbedFieldData|EmbedFieldData[]} fields The fields to set
     * @returns {MessageEmbed}
     */
    setFields(...fields) {
        this.spliceFields(0, this.fields.length, fields);
        return this;
    }

    /**
     * The options to provide for setting an author for a {@link MessageEmbed}.
     * @typedef {Object} EmbedAuthorData
     * @property {string} name The name of this author.
     * @property {string} [url] The URL of this author.
     * @property {string} [iconURL] The icon URL of this author.
     */

    /**
     * Sets the author of this embed.
     * @param {string|EmbedAuthorData|null} options The options to provide for the author.
     * Provide `null` to remove the author data.
     * @param {string} [deprecatedIconURL] The icon URL of this author.
     * <warn>This parameter is **deprecated**. Use the `options` parameter instead.</warn>
     * @param {string} [deprecatedURL] The URL of this author.
     * <warn>This parameter is **deprecated**. Use the `options` parameter instead.</warn>
     * @returns {MessageEmbed}
     */
    setAuthor(options, deprecatedIconURL, deprecatedURL) {
        if (options === null) {
            this.author = {};
            return this;
        }

        const { name, url, iconURL } = options;
        this.author = { name: utils.verifyString(name, "EMBED_AUTHOR_NAME"), url, iconURL };
        return this;
    }

    /**
     * Sets the color of this embed.
     * @param {ColorResolvable} color The color of the embed
     * @returns {MessageEmbed}
     */
    setColor(color) {
        this.color = utils.resolveColor(color);
        return this;
    }

    /**
     * Sets the description of this embed.
     * @param {string} description The description
     * @returns {MessageEmbed}
     */
    setDescription(description) {
        this.description = utils.verifyString(description, "EMBED_DESCRIPTION");
        return this;
    }

    /**
     * The options to provide for setting a footer for a {@link MessageEmbed}.
     * @typedef {Object} EmbedFooterData
     * @property {string} text The text of the footer.
     * @property {string} [iconURL] The icon URL of the footer.
     */

    /**
     * Sets the footer of this embed.
     * @param {string|EmbedFooterData|null} options The options to provide for the footer.
     * Provide `null` to remove the footer data.
     * @param {string} [deprecatedIconURL] The icon URL of this footer.
     * <warn>This parameter is **deprecated**. Use the `options` parameter instead.</warn>
     * @returns {MessageEmbed}
     */
    setFooter(options, deprecatedIconURL) {
        if (options === null) {
            this.footer = undefined;
            return this;
        }

        const { text, iconURL } = options;
        this.footer = { text: utils.verifyString(text, "EMBED_FOOTER_TEXT"), iconURL };
        return this;
    }

    /**
     * Sets the image of this embed.
     * @param {string} url The URL of the image
     * @returns {MessageEmbed}
     */
    setImage(url) {
        this.image = { url };
        return this;
    }

    /**
     * Sets the thumbnail of this embed.
     * @param {string} url The URL of the thumbnail
     * @returns {MessageEmbed}
     */
    setThumbnail(url) {
        this.thumbnail = { url };
        return this;
    }

    /**
     * Sets the timestamp of this embed.
     * @param {Date|number|null} [timestamp=Date.now()] The timestamp or date.
     * If `null` then the timestamp will be unset (i.e. when editing an existing {@link MessageEmbed})
     * @returns {MessageEmbed}
     */
    setTimestamp(timestamp = Date.now()) {
        if (timestamp instanceof Date) timestamp = timestamp.getTime();
        this.timestamp = timestamp;
        return this;
    }

    /**
     * Sets the title of this embed.
     * @param {string} title The title
     * @returns {MessageEmbed}
     */
    setTitle(title) {
        this.title = utils.verifyString(title, "EMBED_TITLE");
        return this;
    }

    /**
     * Sets the URL of this embed.
     * @param {string} url The URL
     * @returns {MessageEmbed}
     */
    setURL(url) {
        this.url = url;
        return this;
    }

    /**
     * Transforms the embed to a plain object.
     * @returns {APIEmbed} The raw data of this embed
     */
    toJSON() {
        return {
            title: this.title,
            type: "rich",
            description: this.description,
            url: this.url,
            timestamp: this.timestamp && new Date(this.timestamp),
            color: this.color,
            fields: this.fields,
            thumbnail: this.thumbnail,
            image: this.image,
            author: this.author && {
                name: this.author.name,
                url: this.author.url,
                icon_url: this.author.iconURL,
            },
            footer: this.footer && {
                text: this.footer.text,
                icon_url: this.footer.iconURL,
            },
        };
    }

    /**
     * Normalizes field input and verifies strings.
     * @param {string} name The name of the field
     * @param {string} value The value of the field
     * @param {boolean} [inline=false] Set the field to display inline
     * @returns {EmbedField}
     */
    static normalizeField(name, value, inline = false) {
        return {
            name: utils.verifyString(name, "EMBED_FIELD_NAME", false),
            value: utils.verifyString(value, "EMBED_FIELD_VALUE", false),
            inline,
        };
    }

    /**
     * @typedef {Object} EmbedFieldData
     * @property {string} name The name of this field
     * @property {string} value The value of this field
     * @property {boolean} [inline] If this field will be displayed inline
     */

    /**
     * Normalizes field input and resolves strings.
     * @param {...EmbedFieldData|EmbedFieldData[]} fields Fields to normalize
     * @returns {EmbedField[]}
     */
    static normalizeFields(...fields) {
        return fields
            .flat(2)
            .map(field =>
                this.normalizeField(field.name, field.value, typeof field.inline === "boolean" ? field.inline : false),
            );
    }

    /**
     * @external APIEmbed
     * @see {@link https://discord.com/developers/docs/resources/channel#embed-object}
     */
}

class Channel {
    constructor (channelId, client) {
        this.client = client;
        this.id = channelId;
    };

    send(options) {
        return new Promise((resolve, reject) => {
            axios(`https://discord.com/api/v10/channels/${this.id}/messages`, {
                method: "POST",
                headers: {
                    authorization: this.client.token
                },
                data: options
            }).then((res) => {
                resolve(new Message(res.data, this.client));
            }).catch((err) => {
                reject(err.response.data);
            });
        });
    };
};

class Message {
    constructor(data, client) {
        this.client = client;
        this.id = data.id;
        this.channelId = data.channel_id;
        this.author = new User(data.author);
        this.content = data.content || null;
        this.createdAt = new Date(data.timestamp);
        this.createdTimestamp = new Date(data.timestamp).getTime();
        this.editedAt = new Date(data.edited_timestamp);
        this.editedTimestamp = new Date(data.edited_timestamp).getTime();
        this.attachments = new Collection();
        for (const attachment of data.attachments) {
            this.attachments.set(attachment.id, new MessageAttachment(attachment.url, attachment.filename, attachment));
        };
        this.embeds = data.embeds.map((e) => new MessageEmbed(e, true));
        this.webhookId = data.webhook_id || null;
        this.type = [
            "DEFAULT",
            "RECIPIENT_ADD",
            "RECIPIENT_REMOVE",
            "CALL",
            "CHANNEL_NAME_CHANGE",
            "CHANNEL_ICON_CHANGE",
            "CHANNEL_PINNED_MESSAGE",
            "GUILD_MEMBER_JOIN",
            "USER_PREMIUM_GUILD_SUBSCRIPTION",
            "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1",
            "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2",
            "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3",
            "CHANNEL_FOLLOW_ADD",
            null,
            "GUILD_DISCOVERY_DISQUALIFIED",
            "GUILD_DISCOVERY_REQUALIFIED",
            "GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING",
            "GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING",
            "THREAD_CREATED",
            "REPLY",
            "APPLICATION_COMMAND",
            "THREAD_STARTER_MESSAGE",
            "GUILD_INVITE_REMINDER",
            "CONTEXT_MENU_COMMAND"
        ][data.type];
        this.flags = data.flags;
        if(data.message_reference?.message_id) {
            this.reference = {
                channelId: data.message_reference?.channel_id,
                guildId: data.message_reference?.guild_id,
                messageId: data.message_reference?.message_id,
            };
        } else {
            this.reference = null;
        };
        this.channel = new Channel(data.channel_id, client);
    };

    reply(options) {
        if (!this.channel) return Promise.reject(new Error("CHANNEL_NOT_CACHED"));
        return this.channel.send(options);
    }

    edit(options) {
        return new Promise((resolve, reject) => {
            axios(`https://discord.com/api/v10/channels/${this.channelId}/messages/${this.id}`, {
                method: "PATCH",
                headers: {
                    authorization: this.client.token
                },
                data: options
            }).then((res) => {
                resolve(new Message(res.data, this.client));
            }).catch((err) => {
                reject(err.response.data);
            });
        });
    };
}

class Client extends EventEmitter {
    constructor({ intents }) {
        super();
        this.ws = null;
        this.token = null;
        this.intents = new Intents().add(intents).bitfield;
        this.readyAt = null;
        this.interval = null;
        this.user = null;
        this.cache = {
            guilds: new Collection(),
            users: new Collection(),
            channels: new Collection()
        };
    }

    heartbeat(ms) {
        return setInterval(() => {
            this.ws.send(JSON.stringify({
                op: 1,
                d: null
            }));
        }, ms);
    }

    //async login(email, password) {
    login(token) {
        this.token =token;
        /*this.token = (await axios("https://discord.com/api/v10/auth/login", {
            method: "POST",
            headers: {
                "Origin": "https://discord.com",
                "Content-Type": "application/json"
            },
            data: {
                login: email,
                password
            }
        })).data.token;*/
        this.ws = new WebSocket("wss://gateway.discord.gg/?v=6&encoding=json");

        this.ws.on("message", async (data) => {
            /**
             * DOCS:
             * https://discord.com/developers/docs/topics/gateway
             * https://github.com/meew0/discord-api-docs-1/blob/master/docs/topics/GATEWAY.md
             */
            const { op, d, s, t } = JSON.parse(data.toString("utf-8"));
            switch (op) {
                case 0: {
                    switch (t) {
                        /**
                         * EVENTS: If you want to add another event
                         * https://discord.com/developers/docs/topics/gateway-events#receive-events
                         */
                
                        case "HELLO": {}; break;
                        case "READY": {
                            this.user = new User(d.user, this);
                            this.emit("ready");
                        }; break;
                        case "RESUMED": {}; break;
                        case "RECONNECT": {}; break;
                        case "INVALID_SESSION": {}; break;
                        case "APPLICATION_COMMAND_PERMISSIONS_UPDATE": {}; break;

                        // AUTO MODERATION
                        case "AUTO_MODERATION_RULE_CREATE": {}; break;
                        case "AUTO_MODERATION_RULE_UPDATE": {}; break;
                        case "AUTO_MODERATION_RULE_DELETE": {}; break;
                        case "AUTO_MODERATION_ACTION_EXECUTION": {}; break;

                        // CHANNEL
                        case "CHANNEL_CREATE": {}; break;
                        case "CHANNEL_UPDATE": {}; break;
                        case "CHANNEL_DELETE": {}; break;
                        case "CHANNEL_PINS_UPDATE": {}; break;

                        // THREAD
                        case "THREAD_CREATE": {}; break;
                        case "THREAD_UPDATE": {}; break;
                        case "THREAD_DELETE": {}; break;
                        case "THREAD_LIST_SYNC": {}; break;
                        case "THREAD_MEMBER_UPDATE": {}; break;
                        case "THREAD_MEMBERS_UPDATE": {}; break;

                        // GUILD
                        case "GUILD_CREATE": {}; break;
                        case "GUILD_UPDATE": {}; break;
                        case "GUILD_AUDIT_LOG_ENTRY_CREATE": {}; break;
                        case "GUILD_BAN_ADD": {}; break;
                        case "GUILD_BAN_REMOVE": {}; break;
                        case "GUILD_EMOJIS_UPDATE": {}; break;
                        case "GUILD_STICKERS_UPDATE": {}; break;
                        case "GUILD_INTEGRATIONS_UPDATE": {}; break;
                        case "GUILD_MEMBER_ADD": {}; break;
                        case "GUILD_MEMBER_REMOVE": {}; break;
                        case "GUILD_MEMBER_UPDATE": {}; break;
                        case "GUILD_MEMBERS_CHUNK": {}; break;
                        case "GUILD_ROLE_CREATE": {}; break;
                        case "GUILD_ROLE_UPDATE": {}; break;
                        case "GUILD_ROLE_DELETE": {}; break;
                        case "GUILD_SCHEDULED_EVENT_CREATE": {}; break;
                        case "GUILD_SCHEDULED_EVENT_UPDATE": {}; break;
                        case "GUILD_SCHEDULED_EVENT_DELETE": {}; break;
                        case "GUILD_SCHEDULED_EVENT_USER_ADD": {}; break;
                        case "GUILD_SCHEDULED_EVENT_USER_REMOVE": {}; break;

                        // INTEGRATION
                        case "INTEGRATION_CREATE": {}; break;
                        case "INTEGRATION_UPDATE": {}; break;
                        case "INTEGRATION_DELETE": {}; break;

                        // INTERACTION
                        case "INTERACTION_CREATE": {}; break;

                        // Invite
                        case "INVITE_CREATE": {}; break;
                        case "INVITE_DELETE": {}; break;

                        // MESSAGE
                        case "MESSAGE_CREATE": {
                            this.emit("messageCreate", new Message(d, this));
                        }; break;
                        case "MESSAGE_UPDATE": {}; break;
                        case "MESSAGE_DELETE": {}; break;
                        case "MESSAGE_DELETE_BULK": {}; break;
                        case "MESSAGE_REACTION_ADD": {
                            this.emit("messageReactionAdd", {
                                guildId: d.guild_id,
                                channelId: d.channel_id,
                                messageId: d.message_id,
                                name: d.emoji.name,
                                id: d.emoji.id
                            }, d.user_id);
                        }; break;
                        case "MESSAGE_REACTION_REMOVE": {}; break;
                        case "MESSAGE_REACTION_REMOVE_ALL": {}; break;
                        case "MESSAGE_REACTION_REMOVE_EMOJI": {}; break;

                        // PRESENCE
                        case "PRESENCE_UPDATE": {}; break;

                        // STAGE INSTANCE
                        case "STAGE_INSTANCE_CREATE": {}; break;
                        case "STAGE_INSTANCE_UPDATE": {}; break;
                        case "STAGE_INSTANCE_DELETE": {}; break;

                        //  TYPING
                        case "TYPING_START": {}; break;

                        // USER
                        case "USER_UPDATE": {}; break;

                        // VOICE
                        case "VOICE_STATE_UPDATE": {}; break;
                        case "VOICE_SERVER_UPDATE": {}; break;

                        // WEBHOOKS
                        case "WEBHOOKS_UPDATE": {}; break;
                    };
                }; break;

                case 10: {
                    const { heartbeat_interval } = d;
                    this.interval = this.heartbeat(heartbeat_interval);
                }; break;
            };
        });

        this.ws.on("open", () => {
            this.ws.send(JSON.stringify({
                op: 2,
                d: {
                    token: this.token,
                    intents: this.intents,
                    properties: {
                        $os: "linux",
                        $browser: "chrome",
                        $device: "chrome"
                    }
                }
            }));
        });
    }

    destroy() {
        this.ws.close();
        this.token = null;
    }
};

module.exports = {
    Collection,
    BitField,
    Intents,
    User,
    MessageAttachment,
    MessageEmbed,
    Channel,
    Message,
    Client
};
