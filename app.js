/**
 * rewebrtc-server project
 *
 * Tho Q Luong <thoqbk@gmail.com>
 * Feb 12, 2017
 */

var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var open = require('open');
var httpsOptions = {
  key: fs.readFileSync('./fake-keys/privatekey.pem'),
  cert: fs.readFileSync('./fake-keys/certificate.pem')
};
let isLocal = process.env.PORT == null;
var serverPort = (process.env.PORT  || 4443);
var server = null;
if (isLocal) {
  server = require('https').createServer(httpsOptions, app);
} else {
  server = require('http').createServer(app);
}
var io = require('socket.io')(server);

let socketIdToNames = {};
//------------------------------------------------------------------------------
//  Serving static files
app.get('/', function(req, res){
  console.log('get /');
  res.sendFile(__dirname + '/index.html');
});

app.get('/draw', function(req, res){
  console.log('get /');
  res.sendFile(__dirname + '/draw.html');
});

app.use('/style', express.static(path.join(__dirname, 'style')));
app.use('/script', express.static(path.join(__dirname, 'script')));
app.use('/image', express.static(path.join(__dirname, 'image')));

server.listen(serverPort, function(){
  console.log('Rewebrtc-server is up and running at %s port', serverPort);
  if (isLocal) {
    open('https://localhost:' + serverPort)
  }
});

//------------------------------------------------------------------------------
//  WebRTC Signaling
function socketIdsInRoom(roomId) {
    var collection = [],
          ns = io.of("/");    // the default namespace is "/"

      if (ns) {
          for (var id in ns.connected) {
              if(roomId) {
                  // ns.connected[id].rooms is an object!
                  var rooms = Object.values(ns.connected[id].rooms);
                  var index = rooms.indexOf(roomId);
                  if(index !== -1) {
                      collection.push(ns.connected[id].id);
                  }
              }
              else {
                  collection.push(ns.connected[id].id);
              }
          }
      }

      return collection;
}

io.on('connection', function(socket){
  console.log('Connection');
  socket.on('disconnect', function(){
    console.log('Disconnect');
    delete socketIdToNames[socket.id];
    if (socket.room) {
      var room = socket.room;
      io.to(room).emit('leave', socket.id);
      socket.leave(room);
    }
  });

  /**
   * Callback: list of {socketId, name: name of user}
   */
  socket.on('join', function(joinData, callback){ //Join room
    let roomId = joinData.roomId;
    let name = joinData.name;
    socket.join(roomId);
    socket.room = roomId;
    socketIdToNames[socket.id] = name;
    var socketIds = socketIdsInRoom(roomId);
    let friends = socketIds.map((socketId) => {
      return {
        socketId: socketId,
        name: socketIdToNames[socketId]
      }
    }).filter((friend) => friend.socketId != socket.id);
    callback(friends);
    //broadcast
    socket.broadcast.to(socket.room).emit('join',{socketId: socket.id, name});
    console.log('Join: ', joinData);
  });

  socket.on('exchange', function(data){
    console.log('exchange', data);
    data.from = socket.id;
    io.to(data.to).emit('exchange',data);
  });

  socket.on("count", function(roomId, callback) {
    var socketIds = socketIdsInRoom(roomId);
    callback(socketIds.length);
  });

});
