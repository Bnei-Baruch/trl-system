import React, {useEffect, useState} from 'react';
import {Accordion, Box, AccordionSummary, Typography, AccordionDetails} from '@material-ui/core';
import {makeStyles} from "@material-ui/core/styles";
import {STUDY_MATERIALS} from "../shared/consts";


const useStyles = makeStyles(
  {
    title: {
      fontWeight: 'bold',
    },
    content: {
      overflow: 'auto',
      textOverflow: 'ellipsis',
      textAlign: 'initial'
    }
  }
);

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

  const classes = useStyles();

  useEffect(() => {
    initMessages();
  }, []);

  const initMessages = async () => {
    const msgs = await fetchMessages();
    if (msgs?.length > 0)
      setMessages(msgs);
  };

  const handleAccordionChange = (name) => name !== expanded ? setExpanded(name) : setExpanded(null);

  const renderMessage = ({Title, Description: __html}, i) => {
    return (
      <Accordion key={i} expanded={expanded === `panel${i}`} onChange={() => handleAccordionChange(`panel${i}`)}>
        <AccordionSummary>
          <Typography className={classes.title}>{Title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography className={classes.content}>
            <div dangerouslySetInnerHTML={{__html}}></div>
          </Typography>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Box style={{height: 'calc(100vh - 140px)', overflow: 'auto'}}>
      {messages.map(renderMessage)}
    </Box>
  );

};

export default HomerLimud;