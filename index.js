const {Plugin} = require("powercord/entities")
const webpack = require("powercord/webpack")
const {getModule} = webpack

const DISCORD_EPOCH = 1420070400000
const DISCORD_TIMESTAMP_BITSHIFT = 22
const PREFERRED_ICON_SIZE = 128
const MS_PER_DAY = 86400000

function getSnowflakeDate(snowflake) {
	return new Date(
		Number(
			BigInt(snowflake) >> BigInt(DISCORD_TIMESTAMP_BITSHIFT)
		) + DISCORD_EPOCH
	)
}

/** @param {Date} date */
function getReadableTime(date) {
	return `${date.toDateString()} @ ${date.toTimeString().split(" ")[0]}`
}

function getIconURL(id, icon, format, size) {
	return `https://cdn.discordapp.com/icons/${id}/${icon}.${format}?size=${size}`
}

function plural(count, thing) {
	return `${count} ${thing}${count === 1 ? "" : "s"}`
}

function getDaysAgo(timestamp) {
	const now = Date.now()
	const difference = Math.floor(Math.abs(Date.now() - timestamp)/MS_PER_DAY)
	if (difference === 0) {
		return "today"
	} if (timestamp < now) { // in the past
		return `${plural(difference, "day")} ago`
	} else { // in the future
		return `in ${plural(difference, "day")}`
	}
}

module.exports = class ServerInfo extends Plugin {
	constructor() {
		super()
	}

	async startPlugin() {
		const getGuild = (await getModule(["getGuild"])).getGuild
		const getUser = (await getModule(["getUser"])).getUser
		const getMemberIds = (await getModule(["getMemberIds"])).getMemberIds
		const getMemberCount = (await getModule(["getMemberCount"])).getMemberCount
		const getChannel = (await getModule(["getChannel"])).getChannel
		const getChannelId = webpack.channels.getChannelId
		const isFriend = (await getModule(["isFriend"])).isFriend

		this.registerCommand(
			"serverinfo",
			["guildinfo"],
			"Get information about the current server.",
			"{c}",
			// code
			() => {
				const channelID = getChannelId()
				const channel = getChannel(channelID)
				if (channel.guild_id) {
					const guild = getGuild(channel.guild_id)

					const fields = []

					let thumbnail
					if (guild.icon) {
						let format = guild.icon.startsWith("a_") ? "gif" : "png"
						let url = getIconURL(guild.id, guild.icon, format, PREFERRED_ICON_SIZE)
						thumbnail = {
							url,
							proxy_url: url,
							width: PREFERRED_ICON_SIZE,
							height: PREFERRED_ICON_SIZE
						}
					}

					let owner = getUser(guild.ownerId)
					let ownerString = ""
					if (owner) {
						ownerString = `**${owner.tag}** (<@${owner.id}>)`
					} else {
						ownerString = `\`${guild.ownerId}\` (uncached user)`
					}

					let boostString = ""
					if (guild.premiumTier > 0) {
						boostString = `\nBoost tier ${guild.premiumTier}, with ${plural(guild.premiumSubscriberCount, "booster")}`
					} else if (guild.premiumSubscriberCount > 0) {
						boostString = `\n${plural(guild.premiumSubscriberCount, "booster")}, no tier yet`
					} else {
						boostString = "\nNo boosts"
					}

					let vanityURLString = ""
					if (guild.vanityURLCode) {
						vanityURLString = `\nVanity URL: https://discord.gg/${guild.vanityURLCode}`
					}

					let iconString = ""
					if (guild.icon) {
						iconString = `\n\nIcon URL: ${getIconURL(guild.id, guild.icon, "png", PREFERRED_ICON_SIZE)}`
					}

					const friendUsernames = []
					getMemberIds(guild.id).forEach(id => {
						if (isFriend(id)) {
							const user = getUser(id)
							friendUsernames.push(user.username)
						}
					})
					if (friendUsernames.length > 0) {
						friendUsernames.sort((a, b) => {
							a = a.toLowerCase()
							b = b.toLowerCase()
							if (a === b) return 0
							else if (a < b) return -1
							else if (a > b) return 1
						})
						fields.push({
							name: `Friends in this server (${friendUsernames.length})`,
							value: friendUsernames.join(", ")
						})
					}

					return {
						send: false,
						result: {
							type: "rich",
							title: guild.name,
							description:
								`ID: **${guild.id}**`
								+`\nCreated on **${getReadableTime(getSnowflakeDate(guild.id))}**, ${getDaysAgo(getSnowflakeDate(guild.id).getTime())}`
								+`\nYou joined on **${getReadableTime(guild.joinedAt)}**, ${getDaysAgo(guild.joinedAt.getTime())}`
								+`\n**${getMemberCount(guild.id)}** members`
								+boostString
								+`\nVoice region **${guild.region}**`
								+vanityURLString
								+`\nOwned by ${ownerString}`
								+iconString
							,
							thumbnail,
							fields
						}
					}
				} else { // no guild_id, so channel is a DM?
					return {
						send: false,
						result: "You just used the _server info_ command — try it again while in a server!"
					}
				}
			}
		)
	}
}
