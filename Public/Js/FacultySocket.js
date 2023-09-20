const socket = io({autoConnect: false});

const username = document.getElementById("myuserid").innerHTML;


let userId1 = null;

socket.auth = { username };
socket.connect();

socket.on("connect_error", (err) => {
  if (err.message === "invalid username") {
    alert("Some Error has occured");
  }
});

// Had to get all the connected user detail so that i can take out my userid that sender userid from it's username so that i fix to.
socket.on("users", (users) => {
  users.forEach((user) => {
    if(user.username === username){
      userId1 = user.userID;
    }
  });
});


// To recieve the message from the server
socket.on("private message", ({ content, from }) => {
  let userId2 = document.getElementById('user1ID').value;
  if(from===userId2){
    let block = document.getElementById('textarea');
    let newtext = document.createElement('p');
    newtext.textContent = content;
    newtext.classList.add('othermessage');
    block.appendChild(newtext);
  }
});

// To send the message
let form  = document.getElementById("messagesender");
if(form!=null){
  form.addEventListener('submit',async (event)=>{
    event.preventDefault();
    
    const data = {
      user1ID: document.getElementById('user1ID').value,
      user2ID: document.getElementById('user2ID').value,
      message: document.getElementById('message').value
    };

    let block = document.getElementById('textarea');
    let newtext = document.createElement('p');
    newtext.textContent = data.message;
    newtext.classList.add('mymessage');
    block.appendChild(newtext);
    
    socket.emit("private message faculty", {
      content: data,
      to: data.user1ID,
    });
  });
}