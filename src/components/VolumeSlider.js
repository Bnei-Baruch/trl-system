import React, { useState, useEffect } from 'react';
import { Button, Text } from '@mantine/core';
import { IconVolume, IconVolumeOff } from '@tabler/icons-react';

// Simple HTML+CSS based volume slider that doesn't depend on Mantine's Slider
const VolumeSlider = (props) => {
    const [value, setValue] = useState(1);
    const [muted, setMuted] = useState(true);

    const handleVolumeChange = (e) => {
        const newValue = parseFloat(e.target.value);
        setValue(newValue);
        if (typeof props.volume === 'function') {
            try {
                props.volume(newValue);
            } catch (error) {
                console.error("Error setting volume:", error);
            }
        }
    };

    const handleMuteToggle = () => {
        const newMutedState = !muted;
        setMuted(newMutedState);
        if (typeof props.mute === 'function') {
            try {
                props.mute(newMutedState);
            } catch (error) {
                console.error("Error setting mute state:", error);
            }
        }
    };

    useEffect(() => {
        if (props.initialValue !== undefined) {
            setValue(props.initialValue);
        }
        if (props.initialMuted !== undefined) {
            setMuted(props.initialMuted);
        }
    }, [props.initialValue, props.initialMuted]);

    const { label, orientation = 'vertical', icon } = props;
    
    const verticalSliderStyle = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            padding: '5px',
        },
        sliderContainer: {
            height: '270px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '10px 0',
            position: 'relative',
        },
        input: {
            WebkitAppearance: 'slider-vertical',
            width: '16px',
            height: '270px',
            background: '#e6e6e6',
            outline: 'none',
            opacity: '0.7',
            transition: 'opacity .2s',
        },
        label: {
            textAlign: 'center',
            marginBottom: '5px',
            fontWeight: 'bold',
        },
        button: {
            marginTop: '5px',
        }
    };

    return (
        <div style={verticalSliderStyle.container}>
            <Text style={verticalSliderStyle.label}>{label}</Text>
            <div style={verticalSliderStyle.sliderContainer}>
                <input
                    type="range"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={handleVolumeChange}
                    style={verticalSliderStyle.input}
                    orient="vertical" // For Firefox
                />
            </div>
            <Button
                variant={muted ? 'filled' : 'outline'}
                color={muted ? 'red' : 'green'}
                onClick={handleMuteToggle}
                style={verticalSliderStyle.button}
            >
                {muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
            </Button>
        </div>
    );
};

export default VolumeSlider;
