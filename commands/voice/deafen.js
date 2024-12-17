const {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    PermissionFlagsBits
} = require('discord.js');

// A Set to keep track of users deafened by the bot
const botDeafenedUsers = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deafen')
        .setDescription('Toggle your deafen status in the voice channel.'),
    async execute(interaction) {
        const member = interaction.guild.members.cache.get(interaction.user.id);

        // Function to log actions to console with timestamps
        const logAction = (message) => {
            const timestamp = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(new Date());
            console.log(`[${timestamp}] ${message}`);
        };

        // Check if the user is in a voice channel
        if (!member.voice.channel) {
            await interaction.reply({
                content: '**You need to be in a voice channel to use this command!**',
                ephemeral: true,
            });
            logAction(`⚠️ ${interaction.user.tag} tried to use /deafen but is not in a voice channel.`);
            return;
        }

        try {
            const isDeafened = member.voice.serverDeaf;

            if (!isDeafened) {
                // Deafen the user and add them to the botDeafenedUsers Set
                await member.voice.setDeaf(true);
                botDeafenedUsers.add(member.id);

                const undeafenButton = new ButtonBuilder()
                    .setCustomId(`undeafenself_${member.id}`)
                    .setLabel('Undeafen Yourself')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔊');

                const row = new ActionRowBuilder().addComponents(undeafenButton);

                await interaction.reply({
                    content: 'You are now deafened in the voice channel.\n-# You can run the command again or click the button below to undeafen yourself.',
                    components: [row],
                    ephemeral: true,
                });

                logAction(`🔇 ${interaction.user.tag} was deafened using /deafen.`);
            } else {
                // Check if the bot deafened the user
                if (botDeafenedUsers.has(member.id)) {
                    await member.voice.setDeaf(false);
                    botDeafenedUsers.delete(member.id);

                    await interaction.reply({
                        content: 'You are now undeafened in the voice channel.',
                        ephemeral: true,
                    });

                    logAction(`🔊 ${interaction.user.tag} was undeafened using /deafen.`);
                } else {
                    // Fetch the audit logs to find who deafened the user
                    const auditLogs = await interaction.guild.fetchAuditLogs({
                        limit: 1,
                        type: 24, // "MEMBER_UPDATE" audit log type
                    });
                    const logEntry = auditLogs.entries.find(
                        (entry) => entry.target.id === member.id
                    );

                    if (logEntry) {
                        const executor = logEntry.executor;

                        const requestButton = new ButtonBuilder()
                            .setCustomId(`requestundeafen_${member.id}`)
                            .setLabel('Request')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔔');

                        const row = new ActionRowBuilder().addComponents(requestButton);

                        await interaction.reply({
                            content: `You were deafened by <@${executor.id}>.\n-# Ask them to undeafen you or click the button below to send an undeafen request.`,
                            components: [row],
                            ephemeral: true,
                        });

                        logAction(`🔒 ${interaction.user.tag} was deafened by ${executor.tag}.`);
                    } else {
                        await interaction.reply({
                            content: '*Unable to determine who deafened you. Please contact a server admin.*',
                            ephemeral: true,
                        });
                        logAction(`❓ Unable to determine who deafened ${interaction.user.tag}.`);
                    }
                }
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: '*An error occurred while trying to toggle your deafen status.*',
                ephemeral: true,
            });
            logAction(`⚠️ Error occurred while processing /deafen for ${interaction.user.tag}.`);
        }
    },

    async handleButton(interaction) {
        if (!interaction.isButton()) return;

        const [action, userId] = interaction.customId.split('_');
        const logAction = (message) => {
            const timestamp = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(new Date());
            console.log(`[${timestamp}] ${message}`);
        };

        try {
            const member = interaction.guild.members.cache.get(userId);

            if (!member) {
                await interaction.reply({
                    content: 'The specified user could not be found in the server or is not in a voice channel.',
                    ephemeral: true,
                });
                logAction(`❓ Button interaction failed: User ${userId} not found.`);
                return;
            }

            if (action === "undeafenself") {
                if (botDeafenedUsers.has(member.id)) {
                    await member.voice.setDeaf(false);
                    botDeafenedUsers.delete(member.id);

                    await interaction.update({
                        content: 'You are now undeafened in the voice channel.',
                        components: [],
                    });

                    logAction(`🔊 ${interaction.user.tag} undeafened themselves using the button.`);
                }
            } else if (action === 'requestundeafen') {
                await interaction.update({
                    content: `You have requested to be undeafened.`,
                    components: [],
                });

                await interaction.channel.send({
                    content: `<@${member.id}> is requesting to be undeafened.`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`undeafen_${member.id}`)
                                .setLabel('Undeafen')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🔊')
                        ),
                    ],
                });

                logAction(`🔔 ${interaction.user.tag} requested to be undeafened.`);
            } else if (action === 'undeafen') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
                    await interaction.reply({
                        content: 'You do not have permission to undeafen this user.',
                        ephemeral: true,
                    });
                    logAction(`⛔ ${interaction.user.tag} attempted to undeafen without permissions.`);
                    return;
                }

                if (!member.voice.serverDeaf) {
                    await interaction.reply({
                        content: 'The user is not currently deafened.',
                        ephemeral: true,
                    });
                    return;
                }

                await member.voice.setDeaf(false);
                await interaction.reply({
                    content: `<@${member.id}> has been undeafened.`,
                });

                logAction(`✅ ${interaction.user.tag} undeafened ${member.user.tag}.`);
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'An error occurred while handling the button interaction.',
                ephemeral: true,
            });
            logAction(`⚠️ Error during button interaction for ${interaction.user.tag}.`);
        }
    }
};
