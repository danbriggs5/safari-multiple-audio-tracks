const videoRow = document.getElementById('videoRow');
const publishBtn = document.getElementById('publish');
const viewBtn = document.getElementById('view');

const pcConfig = {
	iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const randomString = () => Math.floor(Math.random() * 100000000).toString(36);
const socketId = randomString();
const websocketUrl = `wss://${location.host}`;

const ws = new WebSocket(websocketUrl, socketId);
ws.addEventListener('error', e => console.log('Socket error', e));
ws.addEventListener('open', () => console.log('Socket opened'));
ws.addEventListener('close', () => console.log('Socket closed.'));

function send(msg) {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}

function play(element) {
	const prom = element.play();
	if (prom) {
		prom
			.then(() =>
				console.info(`${element.nodeName.toLowerCase()} element is playing`),
			)
			.catch(err => console.error('Play error', err));
	}
}

function subscribe(offer) {
	console.log('Subscribe to', offer.from);
	const from = socketId;
	const to = offer.from;
	const connectionId = offer.connectionId;
	const sub = {};

	sub.connectionId = connectionId;
	sub.pc = new RTCPeerConnection(pcConfig);

	sub.onMessage = msg => {
		if (msg.type === 'iceCandidate' && msg.candidate) {
			sub.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
		}
	};

	sub.pc.onicecandidate = evt =>
		console.log('Candidate', evt) ||
		send({
			from,
			to,
			connectionId,
			type: 'iceCandidate',
			candidate: evt.candidate,
		});

	sub.pc.oniceconnectionstatechange = () =>
		console.log('Ice state change', sub.pc.iceConnectionState);

	sub.pc.ontrack = e => {
		console.info('On remote track', {
			publisherId: offer.from,
			track: e.track,
		});
		if (e.track.kind === 'video') {
			const audio = document.createElement('audio');
			audio.autoplay = true;
			audio.srcObject = e.streams[0];
			videoRow.appendChild(audio);

			const video = document.createElement('video');
			video.setAttribute('playsinline', '');
			video.autoplay = true;
			video.muted = true;
			video.srcObject = e.streams[0];
			videoRow.appendChild(video);

			video.addEventListener('click', () => {
				console.log('Video element clicked. Attempting to play...');
				play(audio);
				play(video);
			});

			// Continually log the state
			setInterval(() => {
				console.log('Viewer state', {
					audioElementPaused: audio.paused,
					audioTrack: e.streams[0].getAudioTracks()[0],
					videoElementPaused: video.paused,
					videoTrack: e.streams[0].getVideoTracks()[0],
				});
			}, 10000);
		}
	};

	sub.pc
		.setRemoteDescription(offer.offer)
		.then(() =>
			sub.pc.createAnswer({
				offerToReceiveAudio: 1,
				offerToReceiveVideo: 1,
			}),
		)
		.then(answer => {
			send({
				from,
				to,
				connectionId,
				type: 'answer',
				answer,
			});
			return sub.pc.setLocalDescription(answer);
		});
}

function grantPermissions() {
	return navigator.mediaDevices
		.getUserMedia({ audio: true, video: true })
		.then(mediaStream => mediaStream.getTracks().forEach(t => t.stop()))
		.catch(err => console.error('Capture', err));
}

function createViewer() {
	publishBtn.disabled = true;
	viewBtn.disabled = true;

	const subs = {};

	ws.addEventListener('message', e => {
		const msg = JSON.parse(e.data);

		if (subs[msg.from] && subs[msg.from].connectionId === msg.connectionId) {
			subs[msg.from].onMessage(msg);
		}
		if (msg.type === 'offer' && !subs[msg.from]) {
			subs[msg.from] = subscribe(msg);
		}
	});

	// Safari won't get host candidate unless we grant cam permission first
	grantPermissions().then(() => {
		setInterval(() => send({ type: 'subscribe', from: socketId }), 1000);
	});
	console.log('Started viewing. Will subscribe to all available publishers.');
}

function publish({ mediaStream, subscriberId }) {
	const connectionId = randomString();
	const from = socketId;
	const to = subscriberId;
	const pub = {};

	pub.connectionId = connectionId;
	pub.pc = new RTCPeerConnection(pcConfig);

	pub.onMessage = msg => {
		if (msg.type === 'iceCandidate' && msg.candidate) {
			pub.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
		}
		if (msg.type === 'answer') {
			pub.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
		}
	};

	pub.pc.onicecandidate = evt =>
		console.log('Candidate', evt) ||
		send({
			from,
			to,
			connectionId,
			type: 'iceCandidate',
			candidate: evt.candidate,
		});

	pub.pc.oniceconnectionstatechange = () =>
		console.log('Ice state change', pub.pc.iceConnectionState);

	mediaStream.getTracks().forEach(t => pub.pc.addTrack(t, mediaStream));

	pub.pc
		.createOffer({
			offerToReceiveAudio: 0,
			offerToReceiveVideo: 0,
		})
		.then(offer => {
			send({
				from,
				to,
				connectionId,
				type: 'offer',
				offer,
			});
			return pub.pc.setLocalDescription(offer);
		});

	return pub;
}

function createPublisher() {
	navigator.mediaDevices
		.getUserMedia({ audio: true, video: true })
		.then(mediaStream => {
			publishBtn.disabled = true;
			viewBtn.disabled = true;

			const pubs = {};

			ws.addEventListener('message', e => {
				const msg = JSON.parse(e.data);

				if (
					pubs[msg.from] &&
					pubs[msg.from].connectionId === msg.connectionId
				) {
					pubs[msg.from].onMessage(msg);
				} else if (msg.type === 'subscribe' && !pubs[msg.from]) {
					pubs[msg.from] = publish({
						mediaStream,
						subscriberId: msg.from,
					});
				}
			});

			console.log('Started publishing. Waiting for viewers.');
		})
		.catch(err => console.error('Capture', err));
}

viewBtn.addEventListener('click', createViewer);
publishBtn.addEventListener('click', createPublisher);
