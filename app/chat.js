const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const callBtn = document.querySelector('#call');
const hangupBtn = document.querySelector('#hangup');
let peerConnection;
let socket;
let localStream;
const room = 'room1'; // 房間先預設為 room1


const socketConnect = () => {
    // 伺服器連線網址：http://localhost:3000
    socket = io('ws://127.0.0.1:4000');

    // 發送房間資訊
    socket.emit('join', room);

    // 監聽加入房間
    socket.on('ready', (msg) => {
        // 發送 Offer SDP
        sendSDP('offer');
    });

    // 監聽收到 Offer
    socket.on('offer', async (desc) => {
        // 設定對方的媒體串流
        await peerConnection.setRemoteDescription(desc);
        // 發送 Answer SDP
        await sendSDP('answer');
    });

    // 監聽收到 Answer
    socket.on('answer', (desc) => {
        // 設定對方的媒體串流
        peerConnection.setRemoteDescription(desc)
    });

    // 監聽收到 ICE 候選位址
    socket.on('ice_candidate', (data) => {
        // RTCIceCandidate 用以定義 ICE 候選位址
        const candidate = new RTCIceCandidate({
            sdpMLineIndex: data.label,
            candidate: data.candidate
        });
        // 加入 ICE 候選位址
        peerConnection.addIceCandidate(candidate);
    });
};


/**
 * @param {String} type offer/answer
 */
const sendSDP = async (type) => {
    try {
        if (!peerConnection) {
            console.log('尚未開啟視訊');
            return;
        }

        const method = type === 'offer' ? 'createOffer' : 'createAnswer';
        const offerOptions = {
            offerToReceiveAudio: true, // 是否傳送聲音流給對方
            offerToReceiveVideo: true // 是否傳送影像流給對方
        };

        // 建立 SDP
        const localSDP = await peerConnection[method](offerOptions);

        // 設定本地 SDP
        await peerConnection.setLocalDescription(localSDP);

        // 發送 SDP
        socket.emit(type, room, peerConnection.localDescription);
    } catch (err) {
        console.log('error: ', err);
    }
};

const createStream = async () => {
    try {
        const constraints = { audio: true, video: true };

        // getUserMedia 取得本地影音串流
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Dom 設置本地媒體串流
        localVideo.srcObject = stream;

        // 傳出媒體串流
        localStream = stream;
    } catch (err) {
        console.log('getUserMedia error: ', err.message, err.name);
    }
};

const createPeerConnection = () => {
    // 設定 iceServer
    const configuration = {
        iceServers: [{
            urls: 'stun:stun.l.google.com:19302' // google 提供免費的 STUN server
        }]
    };
    // 建立 RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);

    // 增加本地串流
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // 找尋到 ICE 候選位址後，送去 Server 與另一位配對
    peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
            // 發送 ICE
            socket.emit('ice_candidate', room, {
                label: e.candidate.sdpMLineIndex,
                id: e.candidate.sdpMid,
                candidate: e.candidate.candidate,
            });
        }
    };

    // 監聽 ICE 連接狀態
    peerConnection.oniceconnectionstatechange = (e) => {
        // 若連接已斷，執行掛斷相關動作
        if (e.target.iceConnectionState === 'disconnected') {
            hangup();
        }
    };

    // 監聽是否有媒體串流傳入
    peerConnection.onaddstream = ({ stream }) => {
        // Dom 加入遠端串流
        remoteVideo.srcObject = stream;
    };
};

// 建立本地媒體串流
createStream();

// 開始連線
const call = () => {
    socketConnect(); // socket 連線
    createPeerConnection(); // 建立 P2P 連線
};

// 關閉連線
const hangup = () => {
    // 移除事件監聽
    peerConnection.onicecandidate = null;
    peerConnection.onnegotiationneeded = null;

    // 關閉 RTCPeerConnection 連線並釋放記憶體
    peerConnection.close();
    peerConnection = null;

    // 傳遞掛斷事件給 Server
    socket.emit('hangup', room);
    socket = null;

    // 移除遠端 video src
    remoteVideo.srcObject = null; // 移除遠端媒體串流
};

callBtn.addEventListener('click', call);
hangupBtn.addEventListener('click', hangup);