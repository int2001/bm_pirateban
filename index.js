#!/usr/bin/env bun
const io = require('socket.io-client');
import dateFormat, { masks } from "dateformat";
const config = require("./config.js")

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
	console.log('Connection error:', error);
});

socket.on('reconnect', () => {
	console.log('Reconnected to server');
});

socket.on('reconnect_error', (error) => {
	console.log('Reconnection error:', error);
});


socket.on('mqtt', (msg) => {
	const lhMsg = JSON.parse(msg.payload);
	if ((lhMsg.Slot == config.slot) && (((Date.now()/1000)-5)-lhMsg.Stop<5) && (lhMsg.LinkCall == config.relais)) {
			if (config.looking_for.indexOf(lhMsg.SourceID) !== -1) {
				console.log(lhMsg.SourceID+' transmitted on TS'+lhMsg.Slot+' to '+lhMsg.DestinationID+' via '+lhMsg.LinkCall+' at '+timeConverter(lhMsg.Stop)+' ('+Math.round((Date.now()/1000)-lhMsg.Stop,1)+'s ago)');
				console.log(lhMsg);
			}
	}
});


function timeConverter(UNIX_timestamp){
	var a = new Date(UNIX_timestamp * 1000);
	return dateFormat(a,"yyyy-mm-dd HH:MM:ss")
}
