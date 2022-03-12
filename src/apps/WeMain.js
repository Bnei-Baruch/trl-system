import React, { Component } from 'react';
import {Button, Container, Message} from "semantic-ui-react";

class WeMain extends Component {

    state = {};

    render() {
        return (
            <Container textAlign='center' >
                <br />
                <Message size='massive'>
                    <Message.Header>
                        WebRTC Translation System
                    </Message.Header>
                    <p>:::</p>
                    <Button size='massive' color='green' onClick={() => window.open("user","_self")} >Listen</Button>
                    <Button size='massive' color='green' onClick={() => window.open("client","_self")} >Translate</Button>
                </Message>
            </Container>
        );
    }
}

export default WeMain;
