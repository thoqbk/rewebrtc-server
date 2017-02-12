/**
 * rewebrtc-server project
 *
 * Tho Q Luong <thoqbk@gmail.com>
 * Feb 12, 2017
 */

var socket = io();

var configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

var peerConnections = {}; //map of {socketId: socket.io id, RTCPeerConnection}
var remoteViewContainer = document.getElementById("remoteViewContainer");
let localStream = null;
let friends = null; //list of {socketId, name}
let me = null; //{socketId, name}

function join(roomId, name, callback) {
  socket.emit('join', {roomId, name}, function(result){
    friends = result;
    console.log('Joins', friends);
    friends.forEach((friend) => {
      createPeerConnection(friend, true);
    });
    if(callback != null) {
      me = {
        socketId: socket.id,
        name: name
      }
      callback();
    }
  });
}

function createPeerConnection(friend, isOffer) {
  let socketId = friend.socketId;
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
    //var element = document.createElement('video');
    //element.id = "remoteView" + socketId;
    //element.autoplay = 'autoplay';
    //element.src = URL.createObjectURL(event.stream);
    //remoteViewContainer.appendChild(element);
    if(window.onFriendCallback != null) {
      window.onFriendCallback(socketId, event.stream);
    }
  };

  retVal.addStream(localStream);

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
      if(window.onDataChannelMessage != null) {
        window.onDataChannelMessage(JSON.parse(event.data));
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

socket.on('exchange', function(data){
  exchange(data);
});

socket.on('leave', function(socketId){
  leave(socketId);
});

socket.on('connect', function(data) {
  console.log('connect');
});

socket.on("join", function(friend) {
  //new friend:
  friends.push(friend);
  console.log("New friend joint conversation: ", friend);
});

function logError(error) {
  console.log("logError", error);
}


//------------------------------------------------------------------------------
// Services
function countFriends(roomId, callback) {
  socket.emit("count", roomId, (count) => {
    console.log("Count friends result: ", count);
    callback(count);
  });
}

function loadLocalStream(muted) {
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localStream = stream;
    var selfView = document.getElementById("selfView");
    selfView.src = URL.createObjectURL(stream);
    selfView.muted = muted;
  }, logError);
}

function broadcastMessage(message) {
  for (var key in peerConnections) {
    var pc = peerConnections[key];
    pc.textDataChannel.send(JSON.stringify(message));
  }
}
