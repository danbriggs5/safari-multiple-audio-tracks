# safari-multiple-audio-tracks
To repro and issue where Safari has trouble playing multiple audio tracks. See https://bugs.webkit.org/show_bug.cgi?id=176282#c20.

## Pre-reqs
- Node 8.3+
- Computer with Chrome
- iOS device

## Getting started
```shell
git clone git@github.com:danbriggs5/safari-multiple-audio-tracks.git
cd safari-multiple-audio-tracks
npm install
npm run start
```

This will run a node server on your machine and expose it to the outside world with [ngrok](https://ngrok.com/). On startup, the server will log the url you should go to.

## Running the test
On your computer:
1. open Chrome or Safari on your computer and go to the ngrok url that was logged on server startup.
2. click "Publish".

On your iOS device:
1. open Safari and visit the same ngrok page.
2. click "View"
3. It will ask for camera/mic access. Accept this. It is just so we will receive host candidates. The tracks will be stopped before we begin viewing so it doesn't impact autoplay.
4. The remote video should appear. Tap the video to call `.play()` on the video and audio elements. The video element will likely already be playing since it is muted but the audio will be paused.

## Expected results
You should hear the remote stream through the audio element.

## Actual results
Most of the time you'll get audio, but sometimes you won't. The audio element is playing and the audio track is in the correct state but you can't hear anything.

You may need to try this multiple times to experience the issue. It sometimes work fine for me 5-10 times in a row. I have been zooming in/out and changing the viewport location between tests to try and make it happen more often. But I'm not sure if that actually does anything.

The issue seems to stop if you uncomment this line from the index.html
```html
<!-- <meta name="viewport" content="width=device-width, initial-scale=1.0"> -->
```

## Gotchas
- The websocket used to connect to ngrok will disconnect from time to time. So if you see a log about the socket disconnected, just refresh the page.
