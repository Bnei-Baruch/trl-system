import React, {Component} from 'react';
import {Message, Icon, Button, Segment, Grid, Table, Select} from 'semantic-ui-react';
import Slider from 'react-rangeslider'
import './VolumeSlider.css';
import {audios_options} from "../shared/consts";

class VolumeSlider extends Component {

    state = {
        value: 1,
        muted: false
    };

    handleOnChange = (value) => {
        this.setState({value});
        this.props.volume(value);
    };

    audioMute = () => {
        this.setState({muted: !this.state.muted})
        this.props.mute(!this.state.muted);
    };

    render() {

        const {label,icon} = this.props;
        const {value,muted} = this.state;

        return (

                <Table basic='very' compact='very'>
                    <Table.Row>
                        <Table.Cell width={3}>
                            {/*<Icon name={icon} />*/}
                            {label}
                        </Table.Cell>
                        <Table.Cell width={9}>
                            <Message>
                                <Slider
                                    type='range'
                                    min={0.01}
                                    max={1}
                                    step={0.01}
                                    value={value}
                                    tooltip={false}
                                    orientation="horizontal"
                                    onChange={this.handleOnChange}>
                                </Slider>
                            </Message>
                        </Table.Cell>
                        <Table.Cell width={2}>
                            <Button
                                positive={!muted}
                                negative={muted}
                                icon={muted ? "volume off" : "volume up"}
                                onClick={this.audioMute}/>
                        </Table.Cell>
                    </Table.Row>
                </Table>

        );
    }
}

export default VolumeSlider;