import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Message, Button, Input, Tab, Label, Menu} from "semantic-ui-react";
import {initChatRoom, getDateString, joinChatRoom, notifyMe} from "../../shared/tools";
import {SHIDUR_ID} from "../../shared/consts";
import {sendProtocolMessage} from "../../shared/protocol";


class Chat extends Component {

    state = {
        ...this.props,
        room_count: 0,
        admin_count: 0,
        chatroom: null,
        input_value: "",
        messages: [],
        support_msgs: [],
        room_chat: true,
        from: null,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
    };

    initChat = (janus) => {
        initChatRoom(janus, null, chatroom => {
            Janus.log(":: Got Chat Handle: ", chatroom);
            this.setState({chatroom});
        }, data => {
            this.onData(data);
        });
    };

    initChatRoom = (user, room) => {
        joinChatRoom(this.state.chatroom,room,user);
        this.setState({room});
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendMessage();
    };

    exitChatRoom = (room) => {
        let {chatroom} = this.state;
        let chatreq = {textroom : "leave", transaction: Janus.randomString(12),"room": room};
        chatroom.data({text: JSON.stringify(chatreq),
            success: () => {
                Janus.log(":: Text room leave callback: ");
                this.setState({messages:[]});
            }
        });
    };

    onData = (data) => {
        Janus.log(":: We got message from Data Channel: ",data);
        var json = JSON.parse(data);
        // var transaction = json["transaction"];
        // if (transactions[transaction]) {
        //     // Someone was waiting for this
        //     transactions[transaction](json);
        //     delete transactions[transaction];
        //     return;
        // }
        var what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            var msg = json["text"];
            msg = msg.replace(new RegExp('<', 'g'), '&lt');
            msg = msg.replace(new RegExp('>', 'g'), '&gt');
            var from = json["from"];
            var dateString = getDateString(json["date"]);
            var whisper = json["whisper"];
            if (whisper === true) {
                // Private message
                Janus.log("-:: It's private message: "+dateString+" : "+from+" : "+msg)
                let {support_msgs} = this.state;
                let message = JSON.parse(msg);
                message.time = dateString;
                support_msgs.push(message);
                this.setState({support_msgs, from});
                if(this.state.room_chat)
                    this.setState({admin_count: this.state.admin_count + 1});
                if(this.props.visible) {
                    this.scrollToBottom();
                } else {
                    notifyMe("Shidur",message.text,true);
                    this.setState({room_chat: false});
                }
            } else {
                // Public message
                let {messages} = this.state;
                let message = JSON.parse(msg);
                message.time = dateString;
                Janus.log("-:: It's public message: ",message);
                messages.push(message);
                this.setState({messages});
                if(!this.state.room_chat)
                    this.setState({room_count: this.state.room_count + 1});
                if(document.hidden)
                    notifyMe(message.user.name, message.text,false);
                this.scrollToBottom();
            }
        } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            Janus.log("-:: Somebody joined - username: "+username+" : display: "+display)
        } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            //var when = new Date();
            Janus.log("-:: Somebody left - username: "+username+" : Time: "+getDateString())
        } else if (what === "kicked") {
            // Somebody was kicked
            // var username = json["username"];
        } else if (what === "destroyed") {
            let room = json["room"];
            Janus.log("The room: "+room+" has been destroyed")
        }
    };

    showSupportMessage = (message) => {
        let {support_msgs} = this.state;
        message.time = getDateString();
        support_msgs.push(message);
        this.setState({support_msgs, from: "Admin"});
        if(this.state.room_chat)
            this.setState({admin_count: this.state.admin_count + 1});
        if(document.hidden)
            notifyMe("Shidur", message.text,true);
        this.scrollToBottom();
    };

    sendMessage = () => {
        this.state.room_chat ? this.sendChatMessage() : this.supportMessage();
    };

    supportMessage = () => {
        //TODO: only when shidur user is online will be avelable send question event, so we need to add check
        const { protocol, user, room, question} = this.props;
        let {support_msgs,input_value} = this.state;
        let text = input_value || " :: Support request :: ";
        let msg = { type: "question", status: !question, room, user, text, time: getDateString()};
        sendProtocolMessage(protocol, user, msg );
        support_msgs.push(msg);
        this.setState({support_msgs,input_value: ""}, () => {
            this.scrollToBottom();
        });
    };

    sendChatMessage = () => {
        let {input_value, user, from, room_chat, support_msgs} = this.state;
        let msg = {user, text: input_value};
        let pvt = room_chat ? "" : from ? {"to": from} : {"to": `${SHIDUR_ID}`};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.room,
            ...pvt,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        this.state.chatroom.data({
            text: JSON.stringify(message),
            error: (reason) => { alert(reason); },
            success: () => {
                Janus.log(":: Message sent ::");
                this.setState({input_value: ""});
                if(!room_chat) {
                    support_msgs.push(msg);
                    this.setState({support_msgs});
                }
            }
        });
    };

    scrollToBottom = () => {
        if(this.refs.end)
            this.refs.end.scrollIntoView({ behavior: 'smooth' })
    };

    tooggleChat = (room_chat) => {
        this.setState({room_chat});
    };

    tabChange = (e, data) => {
        this.tooggleChat(data.activeIndex === 0);
        let count = data.activeIndex === 0 ? "room_count" : "admin_count";
        this.setState({[count]: 0});
        this.scrollToBottom();
    };

    render() {

        const {room_count,admin_count,messages,support_msgs} = this.state;

        let la = (<Label color='red'>{admin_count}</Label>);
        let lr = (<Label color='red'>{room_count}</Label>);

        let room_msgs = messages.map((msg,i) => {
            let {user,time,text} = msg;
            return (
                <div key={i} ref='end'><p>
                    <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                    <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
                </div>
            );
        });

        let admin_msgs = support_msgs.map((msg,i) => {
            let {user,time,text} = msg;
            return (
                <div key={i} ref='end'><p>
                    <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                    <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
                </div>
            );
        });

        const panes = [
            {
                menuItem: (<Menu.Item key='translators' >Translators {room_count > 0 ? lr : ""}</Menu.Item>),
                render: () => <Tab.Pane>
                    <Message className='messages_list'>
                        <div className="messages-wrapper" >
                            {room_msgs}
                        </div>
                    </Message>
                </Tab.Pane>,
            },
            {
                menuItem: (<Menu.Item key='messages' >Support {admin_count > 0 ? la : ""}</Menu.Item>),
                render: () => <Tab.Pane>
                    <Message className='messages_list'>
                        <div className="messages-wrapper">
                            {admin_msgs}
                        </div>
                    </Message>
                </Tab.Pane>,
            },
        ];

        return (
            <div className="chat-panell" >
                <Tab panes={panes} onTabChange={this.tabChange} />
                <Input attached fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                       onChange={(v,{value}) => this.setState({input_value: value})}>
                    <input />
                    <Button positive onClick={this.sendMessage}>Send</Button>
                </Input>
            </div>
        );

    }
}

export default Chat;