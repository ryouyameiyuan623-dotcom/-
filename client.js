const socket = io();
const $ = id => document.getElementById(id);
const roleNames = {citizen:"市民",seer:"占い師",medium:"霊媒師",guard:"騎士",wolf:"人狼",madman:"狂人",fox:"妖狐"};
const roleOrder = ["citizen","seer","medium","guard","wolf","madman","fox"];
let myId = null, roomCode = null, roomState = null, myRole = null, currentAction = null;
const defaultRoles = {citizen:3,seer:1,medium:0,guard:0,wolf:1,madman:0,fox:0};

function showError(id,msg){$(id).textContent=msg||""}
function name(){return $("playerName").value.trim()||"プレイヤー"}
function enterRoom(data){roomCode=data.code;myId=data.id;$("welcome").classList.add("hidden");$("game").classList.remove("hidden");$("roomCodeLabel").textContent=roomCode;showError("welcomeError","")}
function renderRoles(counts){
  $("roleSettings").innerHTML="";
  roleOrder.forEach(role=>{
    const row=document.createElement("label");row.className="role-row";row.textContent=roleNames[role];
    const input=document.createElement("input");input.type="number";input.min="0";input.max="16";input.value=counts[role]??0;input.dataset.role=role;input.setAttribute("aria-label",roleNames[role]+"の人数");
    input.addEventListener("change",()=>{const values={};document.querySelectorAll("#roleSettings input").forEach(el=>values[el.dataset.role]=Number(el.value)||0);socket.emit("setRoles",values)});
    row.appendChild(input);$("roleSettings").appendChild(row);
  });
}
function renderPlayers(players){
  $("players").innerHTML="";
  players.forEach(p=>{
    const li=document.createElement("li"),left=document.createElement("div");left.className="player-meta";
    const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=(p.name||"?").slice(0,1);
    const n=document.createElement("span");n.textContent=p.name+(p.id===myId?"（あなた）":"");
    left.append(avatar,n);li.append(left);
    const tags=[];if(p.isHost)tags.push("HOST");if(!p.connected)tags.push("切断中");if(!p.alive)tags.push("脱落");
    const meta=document.createElement("span");meta.className=p.connected?"tag":"offline";meta.textContent=tags.join(" · ");li.append(meta);$("players").append(li);
  });
  $("playerCount").textContent=players.length+" 人";
}
function fillTargets(players,allowSelf=false){
  const select=$("targetSelect");select.innerHTML="";
  players.filter(p=>p.alive&&(allowSelf||p.id!==myId)).forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=p.name;select.append(o)});
}
function render(){
  if(!roomState)return;
  renderPlayers(roomState.players);
  const isHost=roomState.hostId===myId;
  $("hostControls").classList.toggle("hidden",!isHost||roomState.started);
  if(isHost&&!roomState.started)renderRoles(roomState.roleCounts||defaultRoles);
  $("phaseTitle").textContent=({lobby:"参加者を待っています",night:"夜のターン",day:"昼の話し合い",ended:"ゲーム終了"})[roomState.phase]||"ゲーム";
  $("roundLabel").textContent=roomState.started?"ROUND "+roomState.round:"LOBBY";
  $("notice").textContent=roomState.lastMessage||"";
  $("actionArea").classList.add("hidden");
  if(roomState.phase==="night"&&myRole&&["人狼","占い師","騎士"].includes(myRole)){
    currentAction=myRole==="人狼"?"wolf":myRole==="占い師"?"seer":"guard";
    $("targetLabel").textContent=myRole==="人狼"?"襲撃する相手":myRole==="占い師"?"占う相手":"守る相手";
    fillTargets(roomState.players,myRole==="騎士");
    $("actionBtn").textContent="夜の行動を決定";
    $("actionArea").classList.remove("hidden");
  }else if(roomState.phase==="day"){
    currentAction="vote";$("targetLabel").textContent="投票する相手";fillTargets(roomState.players,true);
    $("actionBtn").textContent="投票する";$("actionArea").classList.remove("hidden");
  }
}
$("createBtn").onclick=()=>socket.emit("createRoom",{name:name()});
$("joinBtn").onclick=()=>socket.emit("joinRoom",{name:name(),code:$("roomCode").value.trim().toUpperCase()});
$("startBtn").onclick=()=>socket.emit("startGame");
$("actionBtn").onclick=()=>{const target=$("targetSelect").value;if(!target)return;if(currentAction==="vote")socket.emit("vote",{target});else socket.emit("nightAction",{target});};
$("copyCodeBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyCodeBtn").textContent="コピーしました"}catch{$("copyCodeBtn").textContent=roomCode}};
$("leaveBtn").onclick=()=>{location.reload()};
socket.on("joined",enterRoom);
socket.on("state",state=>{roomState=state;render()});
socket.on("privateRole",data=>{myRole=data.role;$("privateRole").classList.remove("hidden");$("roleName").textContent=data.role;$("roleDescription").textContent=data.description;render()});
socket.on("actionResult",data=>{$("result").textContent=data.text;$("result").classList.remove("hidden")});
socket.on("errorMessage",msg=>{showError(roomCode?"gameError":"welcomeError",msg)});
socket.on("connect_error",()=>showError("welcomeError","サーバーに接続できません。サーバーが起動しているか確認してください。"));
renderRoles(defaultRoles);
