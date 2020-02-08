import React, { Component } from 'react';
import {client,getUser} from './UserManager';
import { Container,Message,Button,Dropdown } from 'semantic-ui-react';

class LoginPage extends Component {

    state = {
        disabled: true,
        loading: true,
    };

    componentDidMount() {
        this.appLogin();
    };

    appLogin = () => {
        getUser(user => {
            if(user) {
                client.querySessionStatus().then(() => {
                    this.props.checkPermission(user);
                }).catch((error) => {
                    console.log("querySessionStatus: ", error);
                    alert("We detect wrong browser cookies settings");
                    client.signoutRedirect();
                });
            } else {
                client.signinRedirectCallback().then((user) => {
                    if(user.state) window.location = user.state;
                }).catch(() => {
                    client.signinSilent().then(user => {
                        if(user) this.appLogin();
                    }).catch((error) => {
                        console.log("SigninSilent error: ",error);
                        this.setState({disabled: false, loading: false});
                    });
                });
            }
        });
    };

    userLogin = () => {
        this.setState({disabled: true, loading: true});
        getUser(cb => {
            if(!cb) client.signinRedirect({state: window.location.href});
        });
    };

    render() {

        const {disabled, loading} = this.state;

        let login = (<Button size='massive' primary onClick={this.userLogin} disabled={disabled} loading={loading}>Login</Button>);
        //let enter = (<Button size='massive' color='green' onClick={() => this.props.enter()} disabled={disabled} loading={loading}>Enter</Button>);
        let profile = (
            <Dropdown inline text=''>
                <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    {/*<Dropdown.Item text='My Account' onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />*/}
                    <Dropdown.Item text='Sign Out' onClick={() => client.signoutRedirect()} />
                </Dropdown.Menu>
            </Dropdown>);

        return (
            <Container textAlign='center' >
                <br />
                <Message size='massive'>
                    <Message.Header>
                        {this.props.user === null ? "TRL" : "Welcome, "+this.props.user.username}
                        {this.props.user === null ? "" : profile}
                    </Message.Header>
                    <p>WebRTC Translation System</p>
                    {this.props.user === null ? login : this.props.enter}
                    <p><Button color='orange' onClick={() => window.open("tt.mp4", "_blank")} >How to use?</Button></p>
                </Message>
            </Container>
        );
    }
}

export default LoginPage;
