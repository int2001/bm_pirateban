#!/usr/bin/env -S node

const io = require('socket.io-client');
import dateFormat, { masks } from "dateformat";
const config = require("./config/config.js")
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(config.telegram_token, {polling: false});

const BM_DEFAULT_URL = 'https://api.brandmeister.network';
const BM_DEFAULT_OPTS = {
    path: '/lh',
    reconnection: true
};

const socket = io(BM_DEFAULT_URL, BM_DEFAULT_OPTS);

socket.open();

socket.on('connect', () => {
	console.log('Connected to BM API');
});

socket.on('connect_error', (error) => {
	console.log('Connection error to Brandmeister:', error);
});

socket.on('reconnect', () => {
	console.log('Reconnected to BM-server');
});

socket.on('reconnect_error', (error) => {
	console.log('Reconnection error on BM-Reconnect:', error);
});


socket.on('mqtt', (msg) => {
	const lhMsg = JSON.parse(msg.payload);
	if (
		(config.slot.indexOf(lhMsg.Slot) !== -1) &&  // TimeSlot
		(((Date.now()/1000))-lhMsg.Stop<config.karenz) && // Karenz-Zeit 
		(lhMsg.LinkCall == config.relais)) { // Passendes Relais
		if (config.looking_for.indexOf(lhMsg.SourceID) !== -1) {
			let message=(lhMsg.SourceID+' transmitted on TS'+lhMsg.Slot+' to '+lhMsg.DestinationID+' via '+lhMsg.LinkCall+' at '+timeConverter(lhMsg.Stop)+' ('+Math.round((Date.now()/1000)-lhMsg.Stop,1)+'s ago)');
			console.log(message);
			drop_tgs(lhMsg.Slot);
			if (((config.telegram_channel ?? '') !== '') && ((config.telegram_token ?? '') !== '')) {
				bot.sendMessage(config.telegram_channel,'Blacklisted RADIO-ID detected. Dropping ALL dynamic TGs on Slot '+lhMsg.Slot+"\nReason was: "+message);
			}
		}
	}
});


function timeConverter(UNIX_timestamp){
	var a = new Date(UNIX_timestamp * 1000);
	return dateFormat(a,"yyyy-mm-dd HH:MM:ss")
}

function drop_tgs(slot) {
	const url = "https://api.brandmeister.network/v2/device/"+config.relais_id+'/action/dropDynamicGroups/'+slot;

	fetch(url, {
		headers: {
			Authorization: 'Bearer '+config.api_key,
			accept: 'application/json',
		}
	}).then(response => {
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return response.json();
	})
	.then(data => console.log(data))
	.catch(error => console.error("Error:", error));
}
