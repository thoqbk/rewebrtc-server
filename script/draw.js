/**
 * rewebrtc-server project
 *
 * Tho Q Luong <thoqbk@gmail.com>
 * Feb 12, 2017
 */

const DRAW_ROOM = "draw";

var socket = null;
var configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

var peerConnections = {}; //map of {socketId: socket.io id, RTCPeerConnection}
var remoteViewContainer = document.getElementById("remoteViewContainer");
let localStream = null;
let friends = []; //list of {socketId, name}
let me = null; //{socketId, name}

function createPeerConnection(friend, isOffer) {
  let socketId = friend.socketId;
  console.log("Creating peer connection to: ", socketId);
  var retVal = new RTCPeerConnection(configuration);

  peerConnections[socketId] = retVal;

  retVal.onicecandidate = function (event) {
    console.log('onicecandidate', event);
    if (event.candidate) {
      socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
    }
  };

  function createOffer() {
    retVal.createOffer(function(desc) {
      console.log('createOffer', desc);
      retVal.setLocalDescription(desc, function () {
        console.log('setLocalDescription', retVal.localDescription);
        socket.emit('exchange', {'to': socketId, 'sdp': retVal.localDescription });
      }, logError);
    }, logError);
  }

  retVal.onnegotiationneeded = function () {
    console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  }

  retVal.oniceconnectionstatechange = function(event) {
    console.log('oniceconnectionstatechange', event);
    if (event.target.iceConnectionState === 'connected') {
      createDataChannel();
    }
  };

  retVal.onsignalingstatechange = function(event) {
    console.log('onsignalingstatechange', event);
  };

  retVal.onaddstream = function (event) {
    console.log('onaddstream', event);
    if(window.onFriendCallback != null) {
      window.onFriendCallback(socketId, event.stream);
    }
  };

  if(localStream != null) {
    retVal.addStream(localStream);
  }

  function createDataChannel() {
    if (retVal.textDataChannel) {
      return;
    }
    var dataChannel = retVal.createDataChannel("text");

    dataChannel.onerror = function (error) {
      console.log("dataChannel.onerror", error);
    };

    dataChannel.onmessage = function (event) {
      console.log("dataChannel.onmessage:", event.data);
      try {
        let point = JSON.parse(event.data);
        drawLine(point);
      } catch(e) {
        console.log("Invalid point data: ", event.data);
      }
    };

    dataChannel.onopen = function () {
      console.log('dataChannel.onopen');
    };

    dataChannel.onclose = function () {
      console.log("dataChannel.onclose");
    };

    retVal.textDataChannel = dataChannel;
  }

  return retVal;
}

function exchange(data) {
  var fromId = data.from;
  var pc;
  if (fromId in peerConnections) {
    pc = peerConnections[fromId];
  } else {
    let friend = friends.filter((friend) => friend.socketId == fromId)[0];
    if(friend == null) {
      friend = {
        socketId: fromId,
        name: ""
      }
    }
    pc = createPeerConnection(friend, false);
  }

  if (data.sdp) {
    console.log('exchange sdp', data);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
      if (pc.remoteDescription.type == "offer")
      pc.createAnswer(function(desc) {
        console.log('createAnswer', desc);
        pc.setLocalDescription(desc, function () {
          console.log('setLocalDescription', pc.localDescription);
          socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
        }, logError);
      }, logError);
    }, logError);
  } else {
    console.log('exchange candidate', data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
}

function leave(socketId) {
  console.log('leave', socketId);
  var pc = peerConnections[socketId];
  pc.close();
  delete peerConnections[socketId];
  if(window.onFriendLeft) {
    window.onFriendLeft(socketId);
  }
}

function logError(error) {
  console.log("logError", error);
}

//------------------------------------------------------------------------------
// Services
function connectToServer() {

  socket = io({'force new connection': true });

  socket.on('exchange', function(data){
    exchange(data);
  });

  socket.on('disconnect', function() {
    socket = null;
    $("#connect-to-server").show();
    $("#disconnect").hide();
    console.log("Disconnected");
  });

  socket.on('connect', function(data) {
    console.log('connect');
    $("#connect-to-server").hide();
    $("#disconnect").show();
    $("#connect-to-peers").show();

    socket.emit('join', {roomId: DRAW_ROOM, name: ""}, function(result){
      friends = result;
      console.log('Friends', friends);
    });
  });

  socket.on("join", function(friend) {
    //new friend:
    friends.push(friend);
    console.log("New friend joint conversation: ", friend);
  });
}

function disconnect() {
  socket.disconnect();
}

function loadLocalStream(muted) {
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localStream = stream;
  }, logError);
}

function broadcastMessage(message) {
  for (var key in peerConnections) {
    var pc = peerConnections[key];
    pc.textDataChannel.send(JSON.stringify(message));
  }
}

function connectToPeers() {
  friends.forEach((friend) => {
    createPeerConnection(friend, true);
  })
}

loadLocalStream();

let lastPoint = null;

function drawLine(point) {
  if(lastPoint == null) {
    lastPoint = point;
    return;
  }
  var c=document.getElementById("myCanvas");
  var ctx=c.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(point.x, point.y);
  ctx.strokeStyle = '#00F';
  ctx.stroke();
  lastPoint = point;
}

let drawing = false;

function onMouseClick(event) {
  drawing = true;
  let point = {
    x: event.clientX,
    y: event.clientY
  }
  drawLine(point);
}

function onMouseUp(event) {
  drawing = false;
}

function onMouseOut(event) {
  drawing = false;
}

function onMouseMove(event) {
  if(drawing) {
    console.log("Event: ", event);
    let point = {
      x: event.offsetX,
      y: event.offsetY
    };
    broadcastMessage(point);
    drawLine(point);
  }
}
