#!/usr/bin/env -S node

const io = require('socket.io-client');
const config = require('./config/config.js');

const log = (...a) => console.log(new Date().toISOString(), ...a);
log.error = (...a) => console.error(new Date().toISOString(), ...a);

for (const key of ['api_key', 'relais', 'relais_id']) {
	if (!config[key]) throw new Error('config missing: ' + key);
}

const tgEnabled = ((config.telegram_token ?? '') !== '') && ((config.telegram_channel ?? '') !== '');
if (!tgEnabled) log('Telegram disabled: token/channel missing');

function tg(message) {
	if (!tgEnabled) return Promise.resolve();
	return fetch('https://api.telegram.org/bot' + config.telegram_token + '/sendMessage', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ chat_id: config.telegram_channel, text: message }),
		signal: AbortSignal.timeout(10000),
	}).then(response => {
		if (!response.ok) throw new Error('HTTP ' + response.status);
	}).catch(error => log.error('Telegram:', error.message));
}

function timeConverter(UNIX_timestamp) {
	return new Date(UNIX_timestamp * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function drop_tgs(slot) {
	const url = 'https://api.brandmeister.network/v2/device/' + config.relais_id + '/action/dropDynamicGroups/' + slot;

	fetch(url, {
		headers: {
			Authorization: 'Bearer ' + config.api_key,
			accept: 'application/json',
		},
		signal: AbortSignal.timeout(10000),
	}).then(response => {
		if (!response.ok) throw new Error('HTTP ' + response.status);
		return response.json();
	}).then(data => {
		log('dropDynamicGroups TS' + slot + ':', data);
	}).catch(error => {
		log.error('dropDynamicGroups TS' + slot + ':', error.message);
	});
}

process.on('uncaughtException', (error) => {
	log.error('uncaughtException:', error);
	tg('bm_pirateban fatal: ' + error.message).then(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
	log.error('unhandledRejection:', reason);
	tg('bm_pirateban fatal: ' + String(reason)).then(() => process.exit(1));
});

const socket = io('https://api.brandmeister.network', {
	path: '/lh',
	transports: ['websocket'],
	reconnection: true,
});

let firstConnect = true;
let reconnectAttempts = 0;
let outageNotified = false;
let lastActivity = Date.now();
let stallHandled = false;
let lastHardNotify = 0;

socket.on('connect', () => {
	lastActivity = Date.now();
	stallHandled = false;
	reconnectAttempts = 0;
	const wasOutage = outageNotified;
	outageNotified = false;
	log('Connected to BM API');
	if (firstConnect) {
		firstConnect = false;
		tg('BM_Pirateban (re)started and connected to Brandmeister');
	} else if (wasOutage) {
		tg('BM_Pirateban reconnected to Brandmeister');
	}
});

socket.on('disconnect', (reason) => {
	log('Disconnected from BM API:', reason);
});

socket.on('connect_error', (error) => {
	log('Connection error to Brandmeister:', error.message ? error.message : error);
});

socket.on('reconnect_error', (error) => {
	log('Reconnection error on BM-Reconnect:', error.message ? error.message : error);
});

socket.on('reconnect_attempt', () => {
	reconnectAttempts++;
	if (reconnectAttempts >= 3 && !outageNotified) {
		outageNotified = true;
		tg('BM_Pirateban lost connection to Brandmeister, reconnect failing');
	}
});

setInterval(() => {
	if (Date.now() - lastActivity > 3 * 60 * 1000) {
		if (socket.connected && !stallHandled) {
			stallHandled = true;
			log.error('Watchdog: no traffic for 3 minutes, forcing reconnect');
			socket.close();
			setTimeout(() => socket.open(), 2000);
			return;
		}
		if (Date.now() - lastActivity > 6 * 60 * 1000) {
			const notify = Date.now() - lastHardNotify > 30 * 60 * 1000;
			log.error('Watchdog: no traffic for 6 minutes, exiting');
			if (notify) {
				lastHardNotify = Date.now();
				tg('BM_Pirateban: no Brandmeister connection, restarting').then(() => process.exit(1));
			} else {
				process.exit(1);
			}
		}
	}
}, 60 * 1000).unref();

socket.on('mqtt', (msg) => {
	lastActivity = Date.now();
	let lhMsg;
	try {
		lhMsg = JSON.parse(msg.payload);
	} catch (error) {
		log.error('Invalid mqtt payload:', error.message);
		return;
	}
	if (
		(config.slot.indexOf(lhMsg.Slot) !== -1) &&  // TimeSlot
		(((Date.now() / 1000) - lhMsg.Stop) < config.karenz) && // Karenz-Zeit
		(lhMsg.LinkCall == config.relais)) { // Passendes Relais
		const looking_for = lhMsg.Slot === 1 ? config.looking_for1 : config.looking_for2;
		if (looking_for.indexOf(lhMsg.SourceID) !== -1) {
			const message = lhMsg.SourceID + ' transmitted on TS' + lhMsg.Slot + ' to ' + lhMsg.DestinationID + ' via ' + lhMsg.LinkCall + ' at ' + timeConverter(lhMsg.Stop) + ' (' + Math.round((Date.now() / 1000) - lhMsg.Stop) + 's ago)';
			log(message);
			drop_tgs(lhMsg.Slot);
			tg('Blacklisted RADIO-ID detected. Dropping ALL dynamic TGs on Slot ' + lhMsg.Slot + '\nReason was: ' + message);
		}
	}
});
