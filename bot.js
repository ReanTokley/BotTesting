const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

const client = new Discord.Client();

const prefix = '!'; // Change this to your desired prefix

const queue = new Map();

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('message', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        execute(message, queue, args);
    } else if (command === 'skip') {
        skip(message, queue);
    } else if (command === 'stop') {
        stop(message, queue);
    }
});

async function execute(message, queue, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    const searchString = args.join(' ');
    const serverQueue = queue.get(message.guild.id);

    let song = {};
    if (ytdl.validateURL(searchString)) {
        const songInfo = await ytdl.getInfo(searchString);
        song = { title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url };
    } else {
        const videoFinder = async (query) => {
            const videoResult = await ytSearch(query);
            return (videoResult.videos.length > 1) ? videoResult.videos[0] : null;
        };

        const video = await videoFinder(searchString);
        if (!video) return message.channel.send('Sorry, I could not find the song you were looking for.');
        song = { title: video.title, url: video.url };
    }

    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };
        queue.set(message.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            const connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0], queue);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`**${song.title}** has been added to the queue!`);
    }
}

function skip(message, queue) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue.connection.dispatcher.end();
}

function stop(message, queue) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.channel.send('There is no song that I could stop!');
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song, queue) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
