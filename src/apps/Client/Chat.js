import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Message, Button, Input, Tab, Label, Menu} from "semantic-ui-react";
import {getDateString, notifyMe} from "../../shared/tools";
//import {SHIDUR_ID} from "../../shared/consts";
import mqtt from "../../shared/mqtt";


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

    initChatEvents = () => {
        // Public chat
        mqtt.mq.on("MqttChatEvent", (data) => {
            let json = JSON.parse(data);
            if(json?.type === "client-chat") {
                this.onChatMessage(json);
            }
        });

        // Private chat
        mqtt.mq.on("MqttPrivateMessage", (data) => {
            let json = JSON.parse(data);
            json["whisper"] = true;
            if(json?.type === "client-chat") {
                this.onChatMessage(json);
            } else if(json?.type === "support") {
                this.showSupportMessage(json);
            } else {
                this.props.onCmdMsg(json);
            }
        });

        // Broadcast message
        mqtt.mq.on("MqttBroadcastMessage", (data) => {
            let json = JSON.parse(data);
            if(json?.type === "client-chat") {
                json.time = getDateString(json["date"]);
                notifyMe("Arvut System", json.text, true);
            } else {
                this.props.onCmdMsg(json);
            }

        });
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendMessage();
    };

    onChatMessage = (message) => {
        const dateString = getDateString();
        message.time = dateString;

        if (message.whisper) {

            let {support_msgs} = this.state;
            message.time = dateString;
            support_msgs.push(message);
            this.setState({support_msgs, from: message.user.display});
            if(this.state.room_chat)
                this.setState({admin_count: this.state.admin_count + 1});
            if(this.props.visible) {
                this.scrollToBottom();
            } else {
                notifyMe("Shidur", message.text,true);
                this.setState({room_chat: false});
            }
        } else {

            // Public message
            let {messages} = this.state;
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
        const {user, room} = this.props;
        let {support_msgs,input_value} = this.state;
        let text = input_value || " :: Support request :: ";
        let msg = {type: "support", status: true, room, user, text, time: getDateString()};
        mqtt.send(JSON.stringify(msg), false, "trl/users/support");
        support_msgs.push(msg);
        this.setState({support_msgs, input_value: ""}, () => {
            this.scrollToBottom();
        });
    };

    sendChatMessage = (user) => {
        const {room_chat} = this.state;
        let {id, role, name} = this.props.user;
        let {input_value, support_msgs} = this.state;

        if (!role.match(/^(user|guest)$/) || input_value === "") {
            return;
        }

        const msg = {user: {id, role, name}, type: "client-chat", text: input_value};
        const topic = user?.id ? `trl/users/${user.id}` : `trl/room/${this.props.room}/chat`;

        mqtt.send(JSON.stringify(msg), false, topic);

        this.setState({input_value: ""});
        if (!room_chat) {
            support_msgs.push(msg);
            this.setState({support_msgs});
        }
    };

    scrollToBottom = () => {
        if(this.roomt)
            this.roomt.scrollIntoView({ behavior: 'smooth' });
        if(this.suppt)
            this.suppt.scrollIntoView({ behavior: 'smooth' });
    };

    tooggleChat = (room_chat) => {
        this.setState({room_chat});
    };

    tabChange = (e, data) => {
        this.tooggleChat(data.activeIndex === 0);
        let count = data.activeIndex === 0 ? "room_count" : "admin_count";
        this.setState({[count]: 0}, () => {
            this.scrollToBottom();
        });
    };

    render() {

        const {room_count,admin_count,messages,support_msgs} = this.state;

        let la = (<Label color='red'>{admin_count}</Label>);
        let lr = (<Label color='red'>{room_count}</Label>);

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

        let room_msgs = messages.map((msg,i) => {
            let {user,time,text} = msg;
            return (
                <div key={i} ref={el => {this.roomt = el;}}><p>
                    <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                    <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
                </div>
            );
        });

        let admin_msgs = support_msgs.map((msg,i) => {
            let {user,time,text} = msg;
            return (
                <div key={i} ref={el => {this.suppt = el;}}><p>
                    <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                    <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
                </div>
            );
        });

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
