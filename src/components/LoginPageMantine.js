import React, { Component } from 'react';
import {kc, getUser} from './UserManager';
import { Container, Paper, Title, Text, Button, Menu, Group, Center } from '@mantine/core';
import { IconUser, IconLogout, IconInfoCircle } from '@tabler/icons-react';

class LoginPageMantine extends Component {
    state = {
        disabled: true,
        loading: true,
    };

    componentDidMount() {
        this.appLogin();
    };

    appLogin = () => {
        getUser((user) => {
            if(user) {
                this.setState({loading: false});
                this.props.checkPermission(user);
            } else {
                this.setState({disabled: false, loading: false});
            }
        });
    };

    userLogin = () => {
        this.setState({disabled: true, loading: true});
        kc.login({redirectUri: window.location.href});
    };

    render() {
        const {disabled, loading} = this.state;
        
        const loginButton = (
            <Button 
                size="xl" 
                onClick={this.userLogin} 
                disabled={disabled} 
                loading={loading}
            >
                Login
            </Button>
        );
        
        const userProfile = (
            <Menu shadow="md" width={200}>
                <Menu.Target>
                    <Button variant="subtle" color="gray">Profile</Button>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Label>Profile</Menu.Label>
                    <Menu.Item 
                        icon={<IconLogout size={14} />} 
                        onClick={() => kc.logout()}
                    >
                        Sign Out
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>
        );

        return (
            <Center style={{ height: '100vh' }}>
                <Paper p="xl" shadow="md" radius="md" sx={{ maxWidth: 500, width: '100%' }}>
                    <Group position="apart" align="center">
                        <Title order={2}>
                            {this.props.user === null ? "TRL" : `Welcome, ${this.props.user.username}`}
                        </Title>
                        {this.props.user !== null && userProfile}
                    </Group>
                    
                    <Text color="dimmed" align="center" size="lg" mt="md" mb="xl">
                        WebRTC Translation System
                    </Text>
                    
                    <Center my="xl">
                        {this.props.user === null ? loginButton : this.props.enter}
                    </Center>
                    
                    <Center mt="xl">
                        <Button 
                            variant="outline" 
                            color="orange" 
                            leftIcon={<IconInfoCircle size={16} />}
                            onClick={() => window.open("tt.mp4", "_blank")}
                        >
                            How to use?
                        </Button>
                    </Center>
                </Paper>
            </Center>
        );
    }
}

export default LoginPageMantine; 