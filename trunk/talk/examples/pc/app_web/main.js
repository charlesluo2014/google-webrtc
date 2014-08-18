'use strict';

var sendChannel;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");

var isChannelReady;
var isInitiator;
var isStarted;
var localStream;
var pc;
var remoteStream;
var turnReady;
var localVideo;
var remoteVideo;
var isCaller = false;
var curPeerId = 0;
var pc_config = webrtcDetectedBrowser === 'firefox' ?
    {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
    {'iceServers': [{'url': 'stun:wittee.org:8889'}]};

var pc_constraints = {
    'optional': [
        {'DtlsSrtpKeyAgreement': true},
        {'RtpDataChannels': true}
    ]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
    'OfferToReceiveAudio':true,
    'OfferToReceiveVideo':true }};

var constraints = {video: {
    mandatory: {
        maxWidth: 640,
        maxHeight: 480}}};

// sendButton.onclick = sendData;
function initialize() {
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    if (localVideo == undefined || remoteVideo == undefined){
        console.log('get video element failed');
    }
    console.log('Getting user media with constraints', constraints);
    getUserMedia(constraints, handleUserMedia, handleUserMediaError);
}
function handleUserMedia(stream) {
    localStream = stream;
    attachMediaStream(localVideo, stream);
    console.log('Adding local stream.');
    maybeStart();
}

function handleUserMediaError(error){
    console.log('getUserMedia error: ', error);
}

/////////////////////////////////////////////

function sendMessage(message) {
    var msgString = JSON.stringify(message);
    console.log('Sending message: ', message);
    send(curPeerId, msgString);
}

function recvMessage(peer_id, message) {
    curPeerId = peer_id;
    message = JSON.parse(message);
    console.log('Received message:', message);
    if (message.type === 'init') {
        initialize();
    } if (message.type == 'ready') {
        if (isCaller)
            doCall();
    }else if (message.type == 'offer'){
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        var candidate = new RTCIceCandidate({sdpMLineIndex:message.sdpMLineIndex,
                                             candidate:message.candidate});
        pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }
}

////////////////////////////////////////////////////

function maybeStart() {
    console.log('call maybeStart()');
    console.log('localStream', localStream);
    console.log('isChannelReady', isChannelReady);
    if (!isStarted && localStream && isChannelReady) {
        createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;
        if (isCaller) {
            sendMessage({type: 'init'});
        } else {
            sendMessage({type: 'ready'});
        }
    }
}


/////////////////////////////////////////////////////////

function createPeerConnection() {
    console.log('call createPeerConnection()');
    try {
        pc = new RTCPeerConnection(pc_config, pc_constraints);
        pc.onicecandidate = handleIceCandidate;
        console.log('Created RTCPeerConnnection with:\n' +
                    '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
                    '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;

    // if (isInitiator) {
    //     try {
    //         // Reliable Data Channels not yet supported in Chrome
    //         sendChannel = pc.createDataChannel("sendDataChannel",
    //                                            {reliable: false});
    //         sendChannel.onmessage = handleMessage;
    //         trace('Created send data channel');
    //     } catch (e) {
    //         alert('Failed to create data channel. ' +
    //               'You need Chrome M25 or later with RtpDataChannel enabled');
    //         trace('createDataChannel() failed with exception: ' + e.message);
    //     }
    //     sendChannel.onopen = handleSendChannelStateChange;
    //     sendChannel.onclose = handleSendChannelStateChange;
    // } else {
    //     pc.ondatachannel = gotReceiveChannel;
    // }
}

function sendData() {
    var data = sendTextarea.value;
    sendChannel.send(data);
    trace('Sent data: ' + data);
}

// function closeDataChannels() {
//   trace('Closing data channels');
//   sendChannel.close();
//   trace('Closed data channel with label: ' + sendChannel.label);
//   receiveChannel.close();
//   trace('Closed data channel with label: ' + receiveChannel.label);
//   localPeerConnection.close();
//   remotePeerConnection.close();
//   localPeerConnection = null;
//   remotePeerConnection = null;
//   trace('Closed peer connections');
//   startButton.disabled = false;
//   sendButton.disabled = true;
//   closeButton.disabled = true;
//   dataChannelSend.value = "";
//   dataChannelReceive.value = "";
//   dataChannelSend.disabled = true;
//   dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
// }

// function gotReceiveChannel(event) {
//     trace('Receive Channel Callback');
//     sendChannel = event.channel;
//     sendChannel.onmessage = handleMessage;
//     sendChannel.onopen = handleReceiveChannelStateChange;
//     sendChannel.onclose = handleReceiveChannelStateChange;
// }

// function handleMessage(event) {
//     trace('Received message: ' + event.data);
//     receiveTextarea.value = event.data;
// }

// function handleSendChannelStateChange() {
//     var readyState = sendChannel.readyState;
//     trace('Send channel state is: ' + readyState);
//     enableMessageInterface(readyState == "open");
// }

// function handleReceiveChannelStateChange() {
//     var readyState = sendChannel.readyState;
//     trace('Receive channel state is: ' + readyState);
//     enableMessageInterface(readyState == "open");
// }

// function enableMessageInterface(shouldEnable) {
//     if (shouldEnable) {
//         dataChannelSend.disabled = false;
//         dataChannelSend.focus();
//         dataChannelSend.placeholder = "";
//         sendButton.disabled = false;
//     } else {
//         dataChannelSend.disabled = true;
//         sendButton.disabled = true;
//     }
// }

function handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            candidate: event.candidate.candidate});
    } else {
        console.log('End of candidates.');
    }
}
function errorNull(e) {
    console.log(e.description);
}
function doCall() {
    console.log('call doCall()');
    var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
    // temporary measure to remove Moz* constraints in Chrome
    if (webrtcDetectedBrowser === 'chrome') {
        for (var prop in constraints.mandatory) {
            if (prop.indexOf('Moz') !== -1) {
                delete constraints.mandatory[prop];
            }
        }
    }
    constraints = mergeConstraints(constraints, sdpConstraints);
    console.log('Sending offer to peer, with constraints: \n' +
                '  \'' + JSON.stringify(constraints) + '\'.');
    pc.createOffer(setLocalAndSendMessage, errorNull, constraints);
}

function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer(setLocalAndSendMessage, errorNull, sdpConstraints);
}

function mergeConstraints(cons1, cons2) {
    var merged = cons1;
    for (var name in cons2.mandatory) {
        merged.mandatory[name] = cons2.mandatory[name];
    }
    merged.optional.concat(cons2.optional);
    return merged;
}

function setLocalAndSendMessage(sessionDescription) {
    // Set Opus as the preferred codec in SDP if Opus is present.
    sessionDescription.sdp = preferOpus(sessionDescription.sdp);
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    // reattachMediaStream(miniVideo, localVideo);
    attachMediaStream(remoteVideo, event.stream);
    remoteStream = event.stream;
    //  waitForRemoteVideo();
}
function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}

function hangup() {
    console.log('Hanging up.');
    stop();
    sendMessage('bye');
}

function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
}

function stop() {
    isStarted = false;
    // isAudioMuted = false;
    // isVideoMuted = false;
    pc.close();
    pc = null;
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
    var sdpLines = sdp.split('\r\n');
    var mLineIndex;
    // Search for m line.
    for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
            mLineIndex = i;
            break;
        }
    }
    if (mLineIndex === null) {
        return sdp;
    }

    // If Opus is available, set it as the default in m line.
    for (i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('opus/48000') !== -1) {
            var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
            if (opusPayload) {
                sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
            }
            break;
        }
    }

    // Remove CN in m line and sdp.
    sdpLines = removeCN(sdpLines, mLineIndex);

    sdp = sdpLines.join('\r\n');
    return sdp;
}

function extractSdp(sdpLine, pattern) {
    var result = sdpLine.match(pattern);
    return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
    var elements = mLine.split(' ');
    var newLine = [];
    var index = 0;
    for (var i = 0; i < elements.length; i++) {
        if (index === 3) { // Format of media starts from the fourth.
            newLine[index++] = payload; // Put target payload to the first.
        }
        if (elements[i] !== payload) {
            newLine[index++] = elements[i];
        }
    }
    return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
    var mLineElements = sdpLines[mLineIndex].split(' ');
    // Scan from end for the convenience of removing an item.
    for (var i = sdpLines.length-1; i >= 0; i--) {
        var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
        if (payload) {
            var cnPos = mLineElements.indexOf(payload);
            if (cnPos !== -1) {
                // Remove CN payload from m line.
                mLineElements.splice(cnPos, 1);
            }
            // Remove CN line in sdp
            sdpLines.splice(i, 1);
        }
    }

    sdpLines[mLineIndex] = mLineElements.join(' ');
    return sdpLines;
}

