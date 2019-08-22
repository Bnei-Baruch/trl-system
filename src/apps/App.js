import React, { Component, Fragment } from 'react';
import {Button} from "semantic-ui-react";
import LoginPage from '../components/LoginPage';
import {client, getUser} from "../components/UserManager";

class TrlApp extends Component {

    state = {
        pass: false,
        user: null,
        roles: [],
    };

    componentDidMount() {
        getUser(cb => {
            if(cb) this.checkPermission(cb);
        });
    };

    checkPermission = (user) => {
        let trl_public = user.roles.filter(role => role === 'bb_user').length === 0;
        if(!trl_public) {
            this.setState({user, roles: user.roles});
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    render() {

        const {user, roles} = this.state;

        let opt = roles.map((role,i) => {
            if(role === "bb_user") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://trl.kli.one/chat","_self")} >Chat</Button>);
            if(role === "trl_user") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://trl.kli.one/client","_self")} >Translate</Button>);
            if(role === "trl_admin") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://trl.kli.one/admin","_self")} >Admin</Button>);
            return false
        });

        return (
            <Fragment>
                <LoginPage user={user} enter={opt} />
            </Fragment>

        );
    }
}

export default TrlApp;