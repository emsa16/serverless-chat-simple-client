/**
 * To setup a websocket connection, and nothing more.
 */
(function () {
    "use strict";

    let ably;

    // const HOST = 'http://localhost:8888';
    const HOST = 'https://emsa-chat-api.netlify.app';
    
    const CHANNEL = "chat";
    const ABLY_TOKEN_REQUEST_ENDPOINT = `${HOST}/api/ably-token-request`;
    const SEND_MESSAGE_ENDPOINT = `${HOST}/api/send-message`;

    let user;

    let connect     = document.getElementById("connect");
    let connectForm = document.getElementById("connect_form");
    let nickname    = document.getElementById("nickname");
    let messageForm = document.getElementById("message_form");
    let messageEl   = document.getElementById("message");
    let close       = document.getElementById("close");
    let output      = document.getElementById("output");
    let status      = document.getElementById("status");



    /**
     * Log output to web browser.
     *
     * @param  {string} message to output in the browser window.
     *
     * @return {void}
     */
    function outputLog(message) {
        let now = new Date();
        let timestamp = now.toLocaleTimeString();

        output.innerHTML += `${timestamp} ${message}<br>`;
        output.scrollTop = output.scrollHeight;
    }



    function parseIncomingMessage(message) {
        let msg;

        try {
            msg = typeof message == 'string' ? JSON.parse(message) : message;
        } catch (error) {
            console.log(`Invalid JSON: ${error}`);
            return;
        }    

        let data = ("data" in msg) ? msg.data : "";
        let nick = ("nickname" in msg && msg.nickname) ? msg.nickname : "anonymous";
        let origin = ("origin" in msg && msg.origin) ? msg.origin : "server";

        if (data && user !== nick) {
            if ("server" == origin) {
                outputLog(`Server: ${data}`);
            } else {
                outputLog(`${nick}: ${data}`);
            }
        }
    }



    function formatMessageOut(message) {
        let data = {command: "message", params: {message}, sender: user};
        let re = /^\/([A-Za-z]+)\s*(\w*)/; // matches '/[COMMAND] [VALUE]', e.g. /nick emil
        let result = re.exec(message);

        if (result && result.length > 1) {
            let command = result[1];

            switch (command) {
                case 'nick':
                    const nickname = result[2] || "";
                    data = {command, params: {nickname}, sender: user};
                    user = nickname;
                    break;
                default:
                    data = {command, sender: user};
            }
        }
        return JSON.stringify(data);
    }



    function sendMessage(message, handleResponse = () => {}) {
        fetch(`${SEND_MESSAGE_ENDPOINT}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: formatMessageOut(message)
        })
            .then((response) => response.json())
            .then(handleResponse)
            .catch(error => { console.error(error) });

    }



    /**
     * What to do when user clicks Connect
     */
    connectForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        if (ably && ably.connection && ['connected', 'connecting'].includes(ably.connection.state)) {
            console.log("Connection already established");
            return;
        }

        if (!nickname.value) {
            outputLog("You need a nickname to connect to chat");
            return;
        }

        ably = new Ably.Realtime.Promise({ authUrl: `${ABLY_TOKEN_REQUEST_ENDPOINT}` });
        await ably.connection.once("connected");
        const channel = ably.channels.get(CHANNEL);
        outputLog("You are now connected to chat.");
        status.innerHTML = "Status: Connected";
        close.removeAttribute("disabled");
        connect.setAttribute("disabled", "");
        user = nickname.value;
        nickname.value = "";
        nickname.setAttribute("disabled", "");
        outputLog(`Nickname set to ${user}.`);
        sendMessage('/connect');

        await channel.subscribe((msg) => {
            console.log("Received message", msg);
            if (msg.data) {
                parseIncomingMessage(msg.data);
            }
        });

        ably.connection.on('closed', () => {
            sendMessage('/disconnect');
            outputLog("Chat connection is now closed.");
            status.innerHTML = "Status: Disconnected";
            connect.removeAttribute("disabled");
            close.setAttribute("disabled", "");
            nickname.removeAttribute("disabled");
        });
    }, false);




    messageForm.addEventListener('submit', function(event) {
        event.preventDefault();

        let message = messageEl.value;

        if (!ably || !ably.connection || ably.connection.state !== 'connected') {
            outputLog("You are not connected to the chat.");
            return;
        }

        const handleResponse = (response) => {
            outputLog(`You: ${message}`);
            parseIncomingMessage(response);
            messageEl.value = "";
        }

        sendMessage(message, handleResponse);
    });



    /**
     * What to do when user clicks Close connection.
     */
    close.addEventListener("click", function(/*event*/) {
        if (!ably || !ably.connection || !['connected', 'connecting'].includes(ably.connection.state)) {
            console.log("Chat connection is already closed");
            return;
        }

        ably.close();
        outputLog("Closing chat.");
    });
})();
