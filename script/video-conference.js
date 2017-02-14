/**
 * rewebrtc-server project
 *
 * Tho Q Luong <thoqbk@gmail.com>
 * Feb 12, 2017
 */

const VIDEO_CONFERENCE_ROOM = "video_conference";

//Load selfView
loadLocalStream(true); //muted

//Count number of sockets in room and change join label
countFriends(VIDEO_CONFERENCE_ROOM, (count) => {
  let joinLabel = "Join this conversation with " + count + " other" + (count > 1 ? "s" : "");
  $(".join-container").show();
  $(".join-container .join-label").text(count == 0 ? "Be the first to join this conversation" : joinLabel);
});

//Join conversation
let handleJoinConversationClick = () => {
  let name = $(".join-container .name").val();
  if(name == null || name == "") {
    alert("Name cannot be empty");
    return;
  }
  //ELSE:
  join(VIDEO_CONFERENCE_ROOM, name, () => {
    $(".join-container").hide();
    $(".videos-container").show();
    $(".chat-container").show();
  });
}

//Open peer connection successfully: show friend
window.onFriendCallback = (socketId, stream) => {
  let friend = friends.filter(friend => friend.socketId == socketId)[0];
  console.log("OnFriendCallback: ", friends);
  let thumbnailElement = document.createElement("div");
  thumbnailElement.className = "video-thumbnail";
  thumbnailElement.style = "width: 30%";
  thumbnailElement.id = "friend-" + socketId;

  let videoElement = document.createElement('video');
  videoElement.className = "video thumbnail";
  videoElement.autoplay = 'autoplay';
  videoElement.src = URL.createObjectURL(stream);
  thumbnailElement.appendChild(videoElement);

  let nameElement = document.createElement("div");
  nameElement.className = "name";
  nameElement.innerText = (friend != null ? friend.name : "");
  thumbnailElement.appendChild(nameElement);

  document.getElementsByClassName("videos-container")[0].appendChild(thumbnailElement);
}

window.onDataChannelMessage = (message) => {
  addMessage(message);
}

window.onFriendLeft = (socketId) => {
  $("#friend-" + socketId).remove();
}

function handleInputChatContentKeyPress(event) {
  if (event.keyCode != 13) {
    return;
  }
  let content = $(".input-container textarea").val().trim();
  if(content != "") {
    let message = {
      name: me.name,
      content
    }
    broadcastMessage(message);
    addMessage(message);
  }
  setTimeout(() => {
    $(".input-container textarea").val("");
  }, 100);
}

function addMessage(message) {
  let messageElement = document.createElement("p");
  messageElement.className = "message";

  let nameElement = document.createElement("span");
  nameElement.className = "name";
  nameElement.innerText = message.name;
  messageElement.appendChild(nameElement);

  let contentElement = document.createElement("span");
  contentElement.className = "content";
  contentElement.innerText = message.content;
  messageElement.appendChild(contentElement);

  let messagesElement = document.getElementsByClassName("messages")[0];

  messagesElement.appendChild(messageElement);

  //scroll to bottom
  setTimeout(() => {
    messagesElement.scrollTop = messagesElement.scrollHeight - messagesElement.clientHeight;
  }, 100);
}
