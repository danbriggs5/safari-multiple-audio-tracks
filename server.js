/*
Facilitates the webrtc signalling between the publisher code on your local machine and
the receiver code running in puppeteer.
*/

const assert = require('assert');
const express = require('express');
const ngrok = require('ngrok');
const path = require('path');
const WebSocketServer = require('ws').Server;

const PORT = 8888;

(async function start() {
	const sockets = {};
	const expressApp = express()
		.use(express.static(path.join(__dirname, 'client')))
		.listen(PORT);

	const socketServer = new WebSocketServer({ server: expressApp });

	// This will create a new ngrok url each time
	const ngrokUrl = await ngrok.connect({ port: PORT });

	socketServer.on('connection', (socket, req) => {
		const socketId = req.headers['sec-websocket-protocol'];
		assert(socketId, 'Sockets must provide a socket id');

		console.log('Socket connected', { socketId });

		socket.on('message', json => {
			const msg = JSON.parse(json);

			if (msg.to) {
				if (sockets[msg.to]) {
					sockets[msg.to].send(json);
				} else {
					console.warn("Receiver doesn't exist", { receiver: msg.to });
				}
			} else {
				Object.keys(sockets).forEach(i => sockets[i].send(json));
			}
		});

		socket.on('close', () => {
			console.log('Socket closed', { socketId });
			delete sockets[socketId];
		});

		sockets[socketId] = socket;
	});

	console.log('Server is running. Visit:', ngrokUrl);
})().catch(err => console.error('Failed to start', err));
