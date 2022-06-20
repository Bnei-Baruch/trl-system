export const PROTOCOL_ROOM = 1000;
export const TRL_MQTT_URL = process.env.REACT_APP_TRL_MQTT_URL;
export const WE_MQTT_URL = process.env.REACT_APP_WE_MQTT_URL;
export const SHIDUR_ID = "ce332655-d702-40d0-83eb-a6b950976984";
export const GEO_IP_INFO = process.env.REACT_APP_GEO_IP_INFO;
export const JANUS_SRV_TRL = process.env.REACT_APP_JANUS_SRV_TRL;
export const JANUS_SRV_STR = process.env.REACT_APP_JANUS_SRV_STR;
export const STUN_SRV1 = process.env.REACT_APP_STUN_SRV1;
export const STUN_SRV2 = process.env.REACT_APP_STUN_SRV2;
export const STUN_SRV_STR = process.env.REACT_APP_STUN_SRV_STR;
export const JANUS_SRV_ADMIN = process.env.REACT_APP_JANUS_SRV_ADMIN;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;
export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
export const STUDY_MATERIALS = process.env.REACT_APP_STUDY_MATERIALS;

export const audios_options = [
    { key: 'sr', value: 61, text: 'Source' },
    { key: 'he', value: 15, text: 'Hebrew' },
    { key: 'ru', value: 23, text: 'Russian' },
    { key: 'en', value: 24, text: 'English' },
    { key: 'es', value: 26, text: 'Spanish' },
    { key: 'fr', value: 25, text: 'French' },
    { key: 'it', value: 28, text: 'Italian' },
    { key: 'de', value: 27, text: 'German' },
    { key: 'tr', value: 42, text: 'Turkish' },
    { key: 'pt', value: 41, text: 'Portuguese' },
    { key: 'bg', value: 43, text: 'Bulgarian' },
    { key: 'ka', value: 44, text: 'Georgian' },
    { key: 'ro', value: 45, text: 'Romanian' },
    { key: 'hu', value: 46, text: 'Hungarian' },
    { key: 'sv', value: 47, text: 'Swedish' },
    { key: 'lt', value: 48, text: 'Lithuanian' },
    { key: 'hr', value: 49, text: 'Croatian' },
    { key: 'ja', value: 50, text: 'Japanese' },
    { key: 'sl', value: 51, text: 'Slovenian' },
    { key: 'pl', value: 52, text: 'Polish' },
    { key: 'no', value: 53, text: 'Norwegian' },
    { key: 'lv', value: 54, text: 'Latvian' },
    { key: 'ua', value: 55, text: 'Ukrainian' },
    { key: 'nl', value: 56, text: 'Dutch' },
    { key: 'cn', value: 57, text: 'Chinese' },
    { key: 'et', value: 58, text: 'Amharic' },
    { key: 'in', value: 59, text: 'Hindi' },
    { key: 'ir', value: 60, text: 'Persian' },
    { key: 'ar', value: 61, text: 'Arabic' },
    { key: 'id', value: 62, text: 'Indonesian' },
];

export const lnglist = {
    Hebrew : {port: 5150, streamid: 15, trlid: 301},
    Russian : {port: 5230, streamid: 23, trlid: 302},
    English : {port: 5240, streamid: 24, trlid: 303},
    French : {port: 5250, streamid: 25, trlid: 305},
    Spanish : {port: 5260, streamid: 26, trlid: 304},
    German : {port: 5270, streamid: 27, trlid: 307},
    Italian : {port: 5280, streamid: 28, trlid: 306},
    Turkish : {port: 5300, streamid: 42},
    Portuguese : {port: 5320, streamid: 41},
    Bulgarian : {port: 5340, streamid: 43},
    Georgian : {port: 5360, streamid: 44},
    Romanian : {port: 5380, streamid: 45},
    Hungarian : {port: 5400, streamid: 46},
    Swedish : {port: 5420, streamid: 47},
    Lithuanian : {port: 5440, streamid: 48},
    Croatian : {port: 5460, streamid: 49},
    Japanese : {port: 5480, streamid: 50},
    Slovenian : {port: 5500, streamid: 51},
    Polish : {port: 5520, streamid: 52},
    Norvegian : {port: 5540, streamid: 53},
    Latvian : {port: 5560, streamid: 54},
    Ukrainian : {port: 5580, streamid: 55},
    Niderland : {port: 5600, streamid: 56},
    China : {port: 5620, streamid: 57},
    Amharic : {port: 5660, streamid: 58},
    Hindi : {port: 5670, streamid: 59},
    Persian : {port: 5680, streamid: 60},
    Arabic : {port: 5690, streamid: 61},
    Indonesian : {port: 5700, streamid: 62},
};

export const langs_list = [
    {"key":1580,"text":"Amharic","value":0},
    {"key":1430,"text":"Bulgarian","value":1},
    {"key":1570,"text":"China","value":2},
    {"key":1490,"text":"Croatian","value":3},
    {"key":1240,"text":"English","value":4},
    {"key":1250,"text":"French","value":5},
    {"key":1440,"text":"Georgian","value":6},
    {"key":1270,"text":"German","value":7},
    {"key":1150,"text":"Hebrew","value":8},
    {"key":1590,"text":"Hindi","value":9},
    {"key":1460,"text":"Hungarian","value":10},
    {"key":1280,"text":"Italian","value":11},
    {"key":1500,"text":"Japanese","value":12},
    {"key":1540,"text":"Latvian","value":13},
    {"key":1480,"text":"Lithuanian","value":14},
    {"key":1560,"text":"Niderland","value":15},
    {"key":1530,"text":"Norvegian","value":16},
    {"key":1600,"text":"Persian","value":17},
    {"key":1520,"text":"Polish","value":18},
    {"key":1410,"text":"Portuguese","value":19},
    {"key":1450,"text":"Romanian","value":20},
    {"key":1230,"text":"Russian","value":21},
    {"key":1510,"text":"Slovenian","value":22},
    {"key":1260,"text":"Spanish","value":23},
    {"key":1470,"text":"Swedish","value":24},
    {"key":1420,"text":"Turkish","value":25},
    {"key":1550,"text":"Ukrainian","value":26},
    {"key":1610,"text":"Arabic","value":27},
    {"key":1620,"text":"Indonesian","value":28},
]
