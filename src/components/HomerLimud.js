import React, {useEffect, useState} from 'react';
import { Accordion, Segment } from 'semantic-ui-react'
import {STUDY_MATERIALS} from "../shared/consts";

const fetchMessages = async () => {
  try {
    const res = await fetch(STUDY_MATERIALS, {method: 'GET'});
    return res.json();
  } catch (e) {
    return null;
  }
};

const HomerLimud = () => {
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState();

  const classes = {
    title: {
      fontWeight: 'bold',
      fontSize: '20px',
      textAlign: 'initial'
    },
    content: {
      overflow: 'auto',
      textOverflow: 'ellipsis',
      textAlign: 'initial'
    }
  };

  useEffect(() => {
    initMessages();
  }, []);

  const initMessages = async () => {
    const msgs = await fetchMessages();
    if (msgs?.length > 0)
      setMessages(msgs);
  };

  const handleAccordionChange = (i) => i !== expanded ? setExpanded(i) : setExpanded(null);

  const renderMessage = ({Title, Description: __html}, i) => {
    return (
      <Accordion key={i} >
        <Accordion.Title onClick={() => handleAccordionChange(i)}>
          <p style={classes.title}>{Title}</p>
        </Accordion.Title>
        <Accordion.Content active={expanded === i}>
          <p style={classes.content}>
            <div dangerouslySetInnerHTML={{__html}} />
          </p>
        </Accordion.Content>
      </Accordion>
    );
  };

  return (
    <Segment basic style={{height: 'calc(100vh - 140px)', overflow: 'auto'}}>
      {messages.map(renderMessage)}
    </Segment>
  );

};

export default HomerLimud;
